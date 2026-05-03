import path from "node:path";
import type { JsonObject, LogEntry, LogLevel, SessionLog, SkillRunStatus } from "@dstack/shared";
import { atomicWrite, ensureDir, fileSafeTimestamp, nowIso } from "./utils.js";

const rank: Record<LogLevel, number> = { debug: 10, info: 20, error: 30 };

export class Logger {
  readonly logDir: string;
  constructor(dstackDir: string, private readonly level: LogLevel) {
    this.logDir = path.join(dstackDir, "logs");
  }
  async createSession(skillName: string, jsonEvents = false): Promise<SessionLogger> {
    await ensureDir(this.logDir);
    return new SessionLogger(this.logDir, skillName, this.level, jsonEvents);
  }
  async writeError(error: Error, context: JsonObject = {}): Promise<string> {
    const filePath = path.join(this.logDir, `error-${fileSafeTimestamp()}.json`);
    await atomicWrite(filePath, JSON.stringify({ timestamp: nowIso(), message: sanitize(error.message), context }, null, 2));
    return filePath;
  }
}

export class SessionLogger {
  readonly filePath: string;
  private readonly log: SessionLog;
  constructor(logDir: string, skillName: string, private readonly level: LogLevel, private readonly jsonEvents = false) {
    this.filePath = path.join(logDir, `${skillName}-${fileSafeTimestamp()}.json`);
    this.log = { skillName, startedAt: nowIso(), completedAt: null, status: "running", entries: [], error: null };
  }
  async event(level: LogLevel, event: string, data: JsonObject = {}): Promise<void> {
    if (rank[level]! < rank[this.level]!) return;
    const entry: LogEntry = { timestamp: nowIso(), level, event, data: JSON.parse(sanitize(JSON.stringify(data))) as JsonObject };
    this.log.entries.push(entry);
    
    if (this.jsonEvents) {
      process.stdout.write(JSON.stringify({ type: event, ...data }) + "\n");
    }
    
    await this.flush();
  }
  async complete(status: SkillRunStatus, error: JsonObject | null = null): Promise<void> {
    this.log.completedAt = nowIso();
    this.log.status = status;
    this.log.error = error;
    
    if (this.jsonEvents) {
      if (status === "error") {
        process.stdout.write(JSON.stringify({ type: "error", ...(error || { message: "Unknown error" }) }) + "\n");
      } else {
        process.stdout.write(JSON.stringify({ type: "complete", status, skillName: this.log.skillName }) + "\n");
      }
    }
    
    await this.flush();
  }
  private async flush(): Promise<void> {
    await atomicWrite(this.filePath, JSON.stringify(this.log, null, 2));
  }
}

export function sanitize(value: string): string {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, "[REDACTED_JWT]")
    .replace(/sk-[a-f0-9]{8,}/g, "[REDACTED_SECRET_KEY]")
    .replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED_PEM]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/ghp_[A-Za-z0-9_]+/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED_ANTHROPIC_KEY]");
}
