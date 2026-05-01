import path from "node:path";
import type { DesignArtifact } from "@dstack/shared";
import { atomicWrite } from "../utils.js";

export interface DesignArtifactRendererOptions {
  projectRoot: string;
  dstackDir: string;
}

export interface DesignRenderRequest {
  artifact: DesignArtifact;
  variantName: string | null;
}

export class DesignArtifactRenderer {
  constructor(private readonly options: DesignArtifactRendererOptions) {}

  async render(request: DesignRenderRequest): Promise<string> {
    const variant = request.variantName ? request.artifact.variants.find((item) => item.name === request.variantName) ?? null : request.artifact.variants[0] ?? null;
    const subject = request.artifact.subject || "design-prototype";
    const fileName = `${safeName(subject)}${variant ? `-${safeName(variant.name)}` : ""}.html`;
    const filePath = path.join(this.options.dstackDir, "design-prototypes", fileName);
    await atomicWrite(filePath, htmlFor(request.artifact, variant?.name ?? request.variantName));
    return filePath;
  }
}

function htmlFor(artifact: DesignArtifact, variantName: string | null): string {
  const title = escapeHtml(`${artifact.subject}${variantName ? ` - ${variantName}` : ""}`);
  const selected = variantName ? artifact.variants.find((variant) => variant.name === variantName) ?? artifact.variants[0] ?? null : artifact.variants[0] ?? null;
  const screens = artifact.screens.map((screen) => {
    const components = asStrings(screen.components).map((component) => `<li>${escapeHtml(component)}</li>`).join("");
    const flows = asStrings(screen.userFlows).map((flow) => `<li>${escapeHtml(flow)}</li>`).join("");
    return `<section class="screen" aria-labelledby="${safeName(String(screen.name ?? "screen"))}-title">
      <div>
        <p class="eyebrow">Screen</p>
        <h2 id="${safeName(String(screen.name ?? "screen"))}-title">${escapeHtml(String(screen.name ?? "Primary Screen"))}</h2>
        <p>${escapeHtml(String(screen.purpose ?? screen.userGoal ?? "Prototype screen"))}</p>
      </div>
      <div class="panel">
        <h3>Components</h3>
        <ul class="chips">${components || "<li>Primary content area</li><li>Action controls</li>"}</ul>
      </div>
      <div class="panel">
        <h3>User Flows</h3>
        <ol>${flows || "<li>Review the page state</li><li>Take the primary action</li>"}</ol>
      </div>
    </section>`;
  }).join("\n");
  const variants = artifact.variants.map((variant) => `<article class="variant${variant.name === selected?.name ? " selected" : ""}">
      <h3>${escapeHtml(variant.name)}</h3>
      <dl>
        <div><dt>Layout</dt><dd>${escapeHtml(variant.layoutParadigm)}</dd></div>
        <div><dt>Components</dt><dd>${escapeHtml(variant.componentPhilosophy)}</dd></div>
        <div><dt>Interaction</dt><dd>${escapeHtml(variant.interactionModel)}</dd></div>
        <div><dt>Visual Direction</dt><dd>${escapeHtml(variant.visualDirection)}</dd></div>
      </dl>
      <div class="tradeoffs">
        <div><h4>Advantages</h4><ul>${variant.advantages.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Clearer review path</li>"}</ul></div>
        <div><h4>Tradeoffs</h4><ul>${variant.disadvantages.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Needs product review</li>"}</ul></div>
      </div>
    </article>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; --ink: #17202e; --muted: #586274; --line: #d8e0ea; --soft: #f5f7fa; --accent: #1d6f8f; --ok: #28724f; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: var(--ink); background: #f7f9fb; line-height: 1.5; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    header { display: grid; gap: 12px; margin-bottom: 24px; }
    .hero, .screen, .variant { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; }
    .hero { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
    .eyebrow { margin: 0 0 6px; color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    h1 { font-size: 34px; margin: 0 0 8px; }
    h2 { font-size: 22px; margin: 0 0 8px; }
    h3 { font-size: 16px; margin: 0 0 10px; }
    h4 { font-size: 14px; margin: 0 0 8px; }
    p { margin: 0; color: var(--muted); }
    .meta { display: grid; gap: 8px; font-size: 13px; color: var(--muted); }
    .meta strong { color: var(--ink); }
    .screens, .variants { display: grid; gap: 16px; }
    .screen { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 16px; align-items: start; margin-bottom: 16px; }
    .panel { background: var(--soft); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 100%; }
    ul, ol { margin: 0; padding-left: 20px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
    .chips li { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; background: #fff; color: var(--ink); }
    .variants { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
    .variant.selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(29, 111, 143, 0.12); }
    dl { display: grid; gap: 8px; margin: 0 0 14px; }
    dt { font-size: 12px; font-weight: 700; color: var(--accent); }
    dd { margin: 0; color: var(--muted); }
    .tradeoffs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .primary-action { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border-radius: 6px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 700; }
    .primary-action:hover { background: #155a75; }
    @media (max-width: 720px) {
      main { padding: 18px 12px 32px; }
      h1 { font-size: 26px; }
      .hero, .screen, .tradeoffs { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header class="hero">
      <div>
        <p class="eyebrow">DStack Prototype</p>
        <h1>${title}</h1>
        <p>Self-contained HTML generated from structured design artifacts for implementation review.</p>
      </div>
      <a class="primary-action" href="#variants" aria-label="Review design direction">Review Direction</a>
      <div class="meta" aria-label="Prototype metadata">
        <span><strong>Subject:</strong> ${escapeHtml(artifact.subject)}</span>
        <span><strong>Variant:</strong> ${escapeHtml(selected?.name ?? variantName ?? "Default")}</span>
        <span><strong>Taste Profile:</strong> ${artifact.tasteProfileApplied ? "Applied" : "Not applied"}</span>
      </div>
    </header>
    <section class="screens" aria-label="Screens">
      ${screens || "<article class=\"screen\"><div><h2>Primary Screen</h2><p>Structured design details were not available, so this prototype shows the base layout shell.</p></div></article>"}
    </section>
    <section id="variants" aria-labelledby="variants-title">
      <h2>Design Direction</h2>
      <div class="variants">${variants || "<article class=\"variant\"><h3>No variants supplied.</h3><p>Add a design-shotgun artifact to compare directions.</p></article>"}</div>
    </section>
  </main>
</body>
</html>`;
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "prototype";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
