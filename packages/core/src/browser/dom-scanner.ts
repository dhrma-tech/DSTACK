export interface BrowserDomScanResult {
  sanitized: string;
  detected: boolean;
  fragments: string[];
}

const explicitInstructionPatterns = [
  /<\s*(INST|SYS)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
  /\[(SYSTEM|INST|INSTRUCTION)\][\s\S]{0,800}/gi,
  /ignore\s+(all\s+)?previous\s+instructions[\s\S]{0,400}/gi,
  /you\s+are\s+now[\s\S]{0,400}/gi,
  /your\s+new\s+instructions\s+are[\s\S]{0,400}/gi
];

const longBase64Pattern = /\b[A-Za-z0-9+/]{200,}={0,2}\b/g;
const redaction = "[CONTENT REDACTED - POSSIBLE INJECTION]";

export function scanDomContent(content: string): BrowserDomScanResult {
  let sanitized = content;
  const fragments: string[] = [];
  for (const pattern of [...explicitInstructionPatterns, longBase64Pattern]) {
    sanitized = sanitized.replace(pattern, (match) => {
      fragments.push(match.slice(0, 240));
      return redaction;
    });
  }
  return { sanitized, detected: fragments.length > 0, fragments };
}
