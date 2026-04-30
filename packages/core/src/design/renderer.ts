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
  const screens = artifact.screens.map((screen) => `<section><h2>${escapeHtml(String(screen.name ?? "Screen"))}</h2><p>${escapeHtml(String(screen.purpose ?? screen.userGoal ?? "Prototype screen"))}</p></section>`).join("\n");
  const variants = artifact.variants.map((variant) => `<li><strong>${escapeHtml(variant.name)}</strong>: ${escapeHtml(variant.layoutParadigm)} with ${escapeHtml(variant.interactionModel)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #18212f; background: #f7f9fb; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
    header, section { background: #fff; border: 1px solid #d9e0e8; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    h1 { font-size: 32px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 0 0 8px; }
    ul { padding-left: 20px; }
    @media (max-width: 480px) { main { padding: 18px 12px; } h1 { font-size: 24px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${title}</h1>
      <p>Static DStack design prototype generated from structured design artifacts.</p>
    </header>
    ${screens || "<section><h2>Primary Screen</h2><p>Structured design details were not available, so this prototype shows the base layout shell.</p></section>"}
    <section>
      <h2>Design Direction</h2>
      <ul>${variants || "<li>No variants supplied.</li>"}</ul>
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
