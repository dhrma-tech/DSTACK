import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { JsonObject } from "@dstack/shared";
import { ArtifactStore } from "../memory.js";
import { ensureDir, fileSafeTimestamp } from "../utils.js";

export interface PDFGeneratorOptions {
  projectRoot: string;
  dstackDir: string;
}

export interface PDFGenerationRequest {
  title: string;
  artifactNames: string[];
}

export interface PDFGenerationResult extends JsonObject {
  title: string;
  artifactsIncluded: string[];
  pageCount: number;
  pdfPath: string;
  fileSizeKb: number;
  generatedAt: string;
  tocIncluded: boolean;
  sectionCount: number;
  sourceSummaries: JsonObject[];
}

export class PDFGenerator {
  constructor(private readonly options: PDFGeneratorOptions) {}

  async generate(request: PDFGenerationRequest): Promise<PDFGenerationResult> {
    const artifacts = new ArtifactStore(this.options.dstackDir);
    const included: string[] = [];
    const summaries: Array<{ name: string; summary: string; details: string[] }> = [];
    for (const name of request.artifactNames) {
      const artifact = await artifacts.readLatest(name);
      if (artifact) {
        included.push(name);
        summaries.push({ name, summary: summarizeArtifact(artifact.content), details: detailLinesForArtifact(artifact.content) });
      }
    }
    const title = request.title || included.join("-") || "dstack-report";
    const pdfPath = path.join(this.options.dstackDir, "exports", `${safeName(title)}-${fileSafeTimestamp()}.pdf`);
    await ensureDir(path.dirname(pdfPath));
    const pages = [
      [`DStack Report: ${title}`, `Generated: ${new Date().toISOString()}`, `Artifacts: ${included.join(", ") || "none"}`],
      summaries.length > 1
        ? ["Table of Contents", ...summaries.map((item, index) => `${index + 1}. ${item.name} - page ${index + 3}`)]
        : ["Report Contents", ...summaries.map((item) => item.name)],
      ...summaries.map((item, index) => [`Section ${index + 1}: ${item.name}`, item.summary, ...item.details])
    ];
    const pdf = minimalPdf(pages);
    await writeFile(pdfPath, pdf, "binary");
    return {
      title,
      artifactsIncluded: included,
      pageCount: pages.length,
      pdfPath,
      fileSizeKb: Math.ceil(Buffer.byteLength(pdf, "binary") / 1024),
      generatedAt: new Date().toISOString(),
      tocIncluded: summaries.length > 1,
      sectionCount: summaries.length,
      sourceSummaries: summaries.map((item) => ({ artifact: item.name, summary: item.summary, details: item.details }))
    };
  }
}

function minimalPdf(pages: string[][]): string {
  const safePages = pages.length > 0 ? pages : [["DStack Report", "No artifacts were available."]];
  const fontObjectId = 3 + safePages.length * 2;
  const kids = safePages.map((_page, index) => `${3 + index * 2} 0 R`).join(" ");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${safePages.length} >>`
  ];
  for (const [index, pageLines] of safePages.entries()) {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const content = pageContent(pageLines);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, "binary")} >> stream\n${content}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body, "binary"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(body, "binary");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefStart}\n%%EOF`;
  return body;
}

function pageContent(lines: string[]): string {
  const escaped = lines.flatMap((line) => wrapText(line, 84)).slice(0, 34).map(escapePdfText);
  const commands = ["BT", "/F1 12 Tf", "72 720 Td"];
  escaped.forEach((line, index) => {
    if (index > 0) commands.push("0 -18 Td");
    commands.push(`(${line}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function summarizeArtifact(value: JsonObject): string {
  const candidate = typeof value.summary === "string" ? value.summary
    : typeof value.overallVerdict === "string" ? `Verdict: ${value.overallVerdict}`
      : typeof value.healthVerdict === "string" ? `Health: ${value.healthVerdict}`
        : typeof value.deployVerdict === "string" ? `Deploy: ${value.deployVerdict}`
          : JSON.stringify(value);
  return candidate.slice(0, 1400);
}

function detailLinesForArtifact(value: JsonObject): string[] {
  const details: string[] = [];
  for (const key of ["overallVerdict", "verdict", "healthVerdict", "deployVerdict", "recommendation", "summary", "screenName", "htmlFilePath"]) {
    const raw = value[key];
    if (typeof raw === "string" && raw.length > 0) details.push(`${titleCase(key)}: ${raw.slice(0, 500)}`);
  }
  const blockers = Array.isArray(value.blockers) ? value.blockers.filter((item): item is string => typeof item === "string") : [];
  if (blockers.length > 0) details.push(`Blockers: ${blockers.slice(0, 5).join("; ")}`);
  const recommendations = Array.isArray(value.topRecommendations) ? value.topRecommendations.filter((item): item is string => typeof item === "string") : [];
  if (recommendations.length > 0) details.push(`Top Recommendations: ${recommendations.slice(0, 5).join("; ")}`);
  return details.length > 0 ? details : ["No structured details were available for this artifact."];
}

function titleCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (match) => match.toUpperCase());
}

function wrapText(value: string, width: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function escapePdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, " ").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}
