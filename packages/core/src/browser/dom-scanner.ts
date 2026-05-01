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
  for (const pattern of explicitInstructionPatterns) {
    sanitized = sanitized.replace(pattern, (match) => {
      fragments.push(match.slice(0, 240));
      return redaction;
    });
  }
  sanitized = sanitized.replace(longBase64Pattern, (match) => {
    const decoded = decodeBase64Candidate(match);
    if (!decoded || !containsExplicitInstruction(decoded)) return match;
    fragments.push(decoded.slice(0, 240));
    return redaction;
  });
  return { sanitized, detected: fragments.length > 0, fragments };
}

function decodeBase64Candidate(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    if (!decoded || decoded.includes("\uFFFD")) return null;
    return decoded;
  } catch {
    return null;
  }
}

function containsExplicitInstruction(value: string): boolean {
  return explicitInstructionPatterns.some((pattern) => new RegExp(pattern.source, pattern.flags.replaceAll("g", "")).test(value));
}
