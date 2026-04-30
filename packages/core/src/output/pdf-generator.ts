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
}

export class PDFGenerator {
  constructor(private readonly options: PDFGeneratorOptions) {}

  async generate(request: PDFGenerationRequest): Promise<PDFGenerationResult> {
    const artifacts = new ArtifactStore(this.options.dstackDir);
    const included: string[] = [];
    for (const name of request.artifactNames) {
      if (await artifacts.readLatest(name)) included.push(name);
    }
    const title = request.title || included.join("-") || "dstack-report";
    const pdfPath = path.join(this.options.dstackDir, "exports", `${safeName(title)}-${fileSafeTimestamp()}.pdf`);
    await ensureDir(path.dirname(pdfPath));
    const pdf = minimalPdf(title, included);
    await writeFile(pdfPath, pdf, "binary");
    return { title, artifactsIncluded: included, pageCount: Math.max(1, included.length), pdfPath, fileSizeKb: Math.ceil(Buffer.byteLength(pdf, "binary") / 1024), generatedAt: new Date().toISOString() };
  }
}

function minimalPdf(title: string, artifacts: string[]): string {
  const text = `DStack Report: ${title} (${artifacts.join(", ") || "no artifacts"})`.replace(/[()\\]/g, "");
  return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${text.length + 44} >> stream
BT /F1 18 Tf 72 720 Td (${text}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`;
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}
