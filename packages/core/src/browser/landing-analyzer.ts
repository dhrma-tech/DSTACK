import path from "node:path";
import { chromium } from "playwright";
import type { JsonObject } from "@dstack/shared";
import { ensureDir, fileSafeTimestamp } from "../utils.js";

export interface LandingReportAnalyzerOptions {
  projectRoot: string;
  dstackDir: string;
  headless?: boolean;
}

export interface LandingReportRequest {
  url: string;
}

export interface LandingReportResult extends JsonObject {
  url: string;
  analyzedAt: string;
  desktopScreenshotPath: string;
  mobileScreenshotPath: string;
  performanceMetrics: JsonObject;
  performanceVerdict: "PASS" | "WARN" | "FAIL";
  aboveFoldAnalysis: JsonObject;
  mobileAnalysis: JsonObject;
  copyIssues: string[];
  accessibilityIssues: string[];
  brokenLinks: string[];
  consoleErrors: string[];
  networkErrors: string[];
  overallScore: number;
  overallVerdict: "PASS" | "WARN" | "FAIL";
  topRecommendations: string[];
  scoreFormula: string;
}

export class LandingReportAnalyzer {
  constructor(private readonly options: LandingReportAnalyzerOptions) {}

  async analyze(request: LandingReportRequest): Promise<LandingReportResult> {
    const screenshotsDir = path.join(this.options.dstackDir, "browser", "screenshots");
    await ensureDir(screenshotsDir);
    const desktopScreenshotPath = path.join(screenshotsDir, `landing-desktop-${fileSafeTimestamp()}.png`);
    const mobileScreenshotPath = path.join(screenshotsDir, `landing-mobile-${fileSafeTimestamp()}.png`);
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    const browser = await chromium.launch({ headless: this.options.headless ?? true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("response", (response) => { if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`); });
      await page.goto(request.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
      const desktop = await page.evaluate(() => {
        const headline = document.querySelector("h1")?.textContent?.trim() ?? "";
        const ctas = Array.from(document.querySelectorAll("a,button"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { text: element.textContent?.trim() ?? "", top: rect.top, width: rect.width, height: rect.height, href: element instanceof HTMLAnchorElement ? element.href : "" };
          })
          .filter((item) => item.text.length > 0 || item.href.length > 0);
        const links = Array.from(document.querySelectorAll("a"))
          .map((anchor) => anchor instanceof HTMLAnchorElement ? anchor.href : "")
          .filter(Boolean);
        const imagesMissingAlt = Array.from(document.querySelectorAll("img")).filter((image) => !(image instanceof HTMLImageElement) || !image.alt.trim()).length;
        const unlabeledInputs = Array.from(document.querySelectorAll("input,textarea,select")).filter((element) => {
          const id = element.getAttribute("id");
          return !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        }).length;
        const resourceWeight = performance.getEntriesByType("resource").reduce((total, entry) => total + ((entry as PerformanceResourceTiming).transferSize || 0), 0);
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const paints = performance.getEntriesByType("paint");
        const fcp = paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? 0;
        return {
          headline,
          ctas,
          links,
          imagesMissingAlt,
          unlabeledInputs,
          performance: {
            lcp: navigation?.loadEventEnd ?? 0,
            fcp,
            tti: navigation?.domInteractive ?? null,
            pageWeightKb: Math.round(((navigation?.transferSize ?? 0) + resourceWeight) / 1024)
          }
        };
      }) as LandingDomSnapshot;
      const headlineText = desktop.headline;
      const ctaCandidates = rankCtas(desktop.ctas).slice(0, 5);
      const firstCta = ctaCandidates[0] ?? null;
      const ctaText = firstCta?.text || null;
      const links = unique(desktop.links).slice(0, 40);
      const brokenLinks = await checkLinks(page.context().request, links);
      await page.setViewportSize({ width: 375, height: 812 });
      const mobile = await page.evaluate(() => {
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const cta = Array.from(document.querySelectorAll("a,button")).find((element) => (element.textContent?.trim() ?? "").length > 0);
        const ctaRect = cta?.getBoundingClientRect();
        const tapTargetIssues = Array.from(document.querySelectorAll("a,button,input,select,textarea"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const label = element.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("name") || element.tagName.toLowerCase();
            return { label, width: rect.width, height: rect.height };
          })
          .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44))
          .slice(0, 8)
          .map((item) => `${item.label}: ${Math.round(item.width)}x${Math.round(item.height)}px`);
        return {
          horizontalScrollPresent: scrollWidth > window.innerWidth + 1,
          ctaVisibleOnMobile: Boolean(ctaRect && ctaRect.top >= 0 && ctaRect.top < window.innerHeight),
          tapTargetIssues
        };
      }) as LandingMobileSnapshot;
      await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
      const copyIssues = copyIssuesFor(headlineText, ctaText);
      const copyMetrics = copyMetricsFor(headlineText, ctaText, copyIssues);
      const accessibilityIssues = [
        ...(headlineText ? [] : ["Missing h1 heading."]),
        ...(desktop.imagesMissingAlt > 0 ? [`${desktop.imagesMissingAlt} image(s) missing alt text.`] : []),
        ...(desktop.unlabeledInputs > 0 ? [`${desktop.unlabeledInputs} form control(s) lack accessible labels.`] : [])
      ];
      const score = Math.max(0, 100
        - consoleErrors.length * 8
        - brokenLinks.length * 8
        - networkErrors.length * 3
        - (headlineText ? 0 : 20)
        - (ctaText ? 0 : 15)
        - (firstCta && firstCta.top <= 760 ? 0 : 10)
        - (mobile.horizontalScrollPresent ? 10 : 0)
        - Math.min(12, mobile.tapTargetIssues.length * 3)
        - Math.min(16, copyIssues.length * 4)
        - Math.min(16, accessibilityIssues.length * 4));
      return {
        url: request.url,
        analyzedAt: new Date().toISOString(),
        desktopScreenshotPath,
        mobileScreenshotPath,
        performanceMetrics: desktop.performance,
        performanceVerdict: performanceVerdict(desktop.performance.pageWeightKb, desktop.performance.fcp),
        aboveFoldAnalysis: { hasHeadline: Boolean(headlineText), headlineText, hasCTA: Boolean(ctaText), ctaText, ctaIsAboveFold: Boolean(firstCta && firstCta.top <= 760), valuePropositionClarity: clarityScore(headlineText), ctaCandidates: ctaCandidates as unknown as JsonObject[] },
        mobileAnalysis: mobile,
        viewportFindings: { desktop: { width: 1440, height: 1000, screenshotPath: desktopScreenshotPath }, mobile: { width: 375, height: 812, screenshotPath: mobileScreenshotPath } },
        linkSummary: { totalLinks: desktop.links.length, checkedLinks: links.length, brokenCount: brokenLinks.length },
        copyMetrics,
        copyIssues,
        accessibilityIssues,
        brokenLinks,
        consoleErrors,
        networkErrors,
        overallScore: score,
        overallVerdict: score >= 80 ? "PASS" : score >= 55 ? "WARN" : "FAIL",
        topRecommendations: recommendations(score, brokenLinks, mobile.horizontalScrollPresent, copyIssues, accessibilityIssues),
        scoreFormula: "100 - console errors*8 - broken links*8 - network errors*3 - missing headline*20 - missing CTA*15 - below-fold CTA*10 - horizontal scroll*10 - tap target/copy/a11y penalties"
      };
    } finally {
      await browser.close();
    }
  }
}

interface LandingCtaSnapshot {
  text: string;
  top: number;
  width: number;
  height: number;
  href: string;
}

interface RankedCtaSnapshot extends LandingCtaSnapshot {
  score: number;
  reason: string;
}

interface LandingDomSnapshot {
  headline: string;
  ctas: LandingCtaSnapshot[];
  links: string[];
  imagesMissingAlt: number;
  unlabeledInputs: number;
  performance: { lcp: number; fcp: number; tti: number | null; pageWeightKb: number };
}

interface LandingMobileSnapshot extends JsonObject {
  ctaVisibleOnMobile: boolean;
  horizontalScrollPresent: boolean;
  tapTargetIssues: string[];
}

async function checkLinks(request: { get(url: string, options?: { timeout?: number }): Promise<{ status(): number; statusText(): string }> }, links: string[]): Promise<string[]> {
  const broken: string[] = [];
  for (const link of links) {
    try {
      const response = await request.get(link, { timeout: 5000 });
      if (response.status() >= 400) broken.push(`${response.status()} ${link}`);
    } catch (error) {
      broken.push(`${error instanceof Error ? error.message : String(error)} ${link}`);
    }
  }
  return broken;
}

function copyIssuesFor(headline: string, ctaText: string | null): string[] {
  const issues: string[] = [];
  if (!headline) issues.push("Missing primary headline.");
  if (headline && headline.split(/\s+/).length < 3) issues.push("Headline may be too terse to communicate the value proposition.");
  if (/\b(revolutionary|innovative|seamless|cutting-edge|world-class)\b/i.test(headline)) issues.push("Headline uses broad marketing language; consider a more concrete promise.");
  if (!ctaText) issues.push("Missing primary CTA.");
  if (ctaText && /^(click here|learn more|submit)$/i.test(ctaText.trim())) issues.push(`CTA text "${ctaText}" is vague.`);
  return issues;
}

function rankCtas(ctas: LandingCtaSnapshot[]): RankedCtaSnapshot[] {
  return ctas.map((cta) => {
    const actionLanguage = /\b(start|get|try|buy|book|schedule|deploy|ship|sign|join|contact|download)\b/i.test(cta.text) ? 30 : 0;
    const aboveFold = cta.top >= 0 && cta.top <= 760 ? 25 : 0;
    const visibleSize = cta.width >= 80 && cta.height >= 36 ? 20 : 0;
    const hrefIntent = /signup|start|demo|pricing|contact|checkout/i.test(cta.href) ? 15 : 0;
    const vaguePenalty = /^(learn more|click here|read more)$/i.test(cta.text.trim()) ? -12 : 0;
    const score = actionLanguage + aboveFold + visibleSize + hrefIntent + vaguePenalty;
    const reason = [
      actionLanguage ? "action language" : null,
      aboveFold ? "above fold" : null,
      visibleSize ? "usable target size" : null,
      hrefIntent ? "conversion href" : null,
      vaguePenalty ? "vague text penalty" : null
    ].filter((item): item is string => Boolean(item)).join(", ") || "visible link/button";
    return { ...cta, score, reason };
  }).sort((a, b) => b.score - a.score);
}

function copyMetricsFor(headline: string, ctaText: string | null, issues: string[]): JsonObject {
  const combined = `${headline} ${ctaText ?? ""}`.trim();
  const wordCount = combined ? combined.split(/\s+/).filter(Boolean).length : 0;
  const jargonCount = (combined.match(/\b(revolutionary|innovative|seamless|cutting-edge|world-class|synergy|platform)\b/gi) ?? []).length;
  const passiveVoiceHints = (combined.match(/\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi) ?? []).length;
  return { wordCount, jargonCount, passiveVoiceHints, issueCount: issues.length };
}

function clarityScore(headline: string): 1 | 2 | 3 | 4 | 5 {
  if (!headline) return 1;
  const words = headline.split(/\s+/).filter(Boolean).length;
  if (words >= 5 && !/\b(revolutionary|innovative|seamless|cutting-edge)\b/i.test(headline)) return 5;
  if (words >= 3) return 4;
  return 2;
}

function performanceVerdict(pageWeightKb: number, fcp: number): "PASS" | "WARN" | "FAIL" {
  if (pageWeightKb > 3000 || fcp > 3000) return "FAIL";
  if (pageWeightKb > 1500 || fcp > 1800) return "WARN";
  return "PASS";
}

function recommendations(score: number, brokenLinks: string[], horizontalScroll: boolean, copyIssues: string[], accessibilityIssues: string[]): string[] {
  const items: string[] = [];
  if (brokenLinks.length > 0) items.push("Fix broken landing page links before using the page in a launch flow.");
  if (horizontalScroll) items.push("Remove mobile horizontal scroll at 375px.");
  if (copyIssues.length > 0) items.push(copyIssues[0]!);
  if (accessibilityIssues.length > 0) items.push(accessibilityIssues[0]!);
  if (score >= 80 && items.length === 0) items.push("Keep the headline, CTA, and mobile layout visible in future edits.");
  return items.slice(0, 5);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
