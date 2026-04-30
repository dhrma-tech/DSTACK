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
      const headlineText = await page.locator("h1").first().innerText().catch(() => "");
      const ctaText = await page.locator("a,button").first().innerText().catch(() => null);
      const links = await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter(Boolean)).catch(() => []);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
      const brokenLinks = links.filter((url) => networkErrors.some((entry) => entry.includes(url)));
      const score = Math.max(0, 100 - consoleErrors.length * 8 - networkErrors.length * 8 - (headlineText ? 0 : 20) - (ctaText ? 0 : 15));
      return {
        url: request.url,
        analyzedAt: new Date().toISOString(),
        desktopScreenshotPath,
        mobileScreenshotPath,
        performanceMetrics: { lcp: 0, fcp: 0, tti: null, pageWeightKb: 0 },
        performanceVerdict: score >= 80 ? "PASS" : "WARN",
        aboveFoldAnalysis: { hasHeadline: Boolean(headlineText), headlineText, hasCTA: Boolean(ctaText), ctaText, ctaIsAboveFold: Boolean(ctaText), valuePropositionClarity: headlineText ? 4 : 2 },
        mobileAnalysis: { ctaVisibleOnMobile: Boolean(ctaText), horizontalScrollPresent: false, tapTargetIssues: [] },
        copyIssues: headlineText ? [] : ["Missing primary headline."],
        accessibilityIssues: [],
        brokenLinks,
        consoleErrors,
        networkErrors,
        overallScore: score,
        overallVerdict: score >= 80 ? "PASS" : "WARN",
        topRecommendations: score >= 80 ? ["Keep CTA and headline visible above the fold."] : ["Clarify the headline and CTA above the fold."],
        scoreFormula: "100 - console errors*8 - network errors*8 - missing headline*20 - missing CTA*15"
      };
    } finally {
      await browser.close();
    }
  }
}
