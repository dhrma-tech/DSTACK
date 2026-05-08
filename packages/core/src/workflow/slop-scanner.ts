export interface SlopFinding {
  phrase: string;
  filePath: string;
  line: number;
  severity: "BLOCKER" | "HIGH";
  remediation: string;
}

export class SlopScannerError extends Error {
  constructor(readonly findings: SlopFinding[]) {
    super(`Generated code contains ${findings.length} placeholder or unsafe implementation marker(s).`);
    this.name = "SlopScannerError";
  }
}

export interface SlopScanResult {
  ok: boolean;
  findings: SlopFinding[];
}

const TRIGGERS: Array<{ phrase: string; pattern: RegExp; severity: "BLOCKER" | "HIGH"; remediation: string }> = [
  { phrase: "TODO: implement later", pattern: /TODO:\s*implement later/i, severity: "BLOCKER", remediation: "Replace the TODO with complete production logic before audit." },
  { phrase: "insert actual logic here", pattern: /insert actual logic here/i, severity: "BLOCKER", remediation: "Provide the concrete implementation, not a placeholder instruction." },
  { phrase: "YOUR_API_KEY", pattern: /YOUR_API_KEY/i, severity: "BLOCKER", remediation: "Use configuration/env indirection and never placeholder secrets in generated code." },
  { phrase: "Rest of the code remains the same", pattern: /rest of the code remains the same/i, severity: "BLOCKER", remediation: "Return the full updated code payload or a precise patch." },
  { phrase: "lorem ipsum", pattern: /lorem ipsum|dolor sit amet/i, severity: "HIGH", remediation: "Replace placeholder copy with domain-appropriate production text." }
];

export class SlopScanner {
  scan(files: Record<string, string>): SlopScanResult {
    const findings: SlopFinding[] = [];
    for (const [filePath, content] of Object.entries(files)) {
      const lines = content.split(/\r?\n/);
      lines.forEach((lineText, index) => {
        for (const trigger of TRIGGERS) {
          if (trigger.pattern.test(lineText)) {
            findings.push({
              phrase: trigger.phrase,
              filePath,
              line: index + 1,
              severity: trigger.severity,
              remediation: trigger.remediation
            });
          }
        }
      });
    }
    return { ok: findings.length === 0, findings };
  }

  assertClean(files: Record<string, string>): void {
    const result = this.scan(files);
    if (!result.ok) throw new SlopScannerError(result.findings);
  }
}
