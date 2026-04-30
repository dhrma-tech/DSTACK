import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PermissionError, type PermissionDecision, type PermissionLevel, type SafetyMode, type ToolCall } from "@dstack/shared";
import { normalMode, SafetyModeManager } from "./safety/mode-manager.js";

const destructive = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bDROP\s+(TABLE|DATABASE)\b/i,
  /\bgit\s+push\s+(--force|-f)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-f[dx]?\b/i,
  /\bcurl\b.*\|\s*(bash|sh)\b/i,
  /\bwget\b.*\|\s*(bash|sh)\b/i,
  /\beval\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bxargs\b/i,
  /\b(bash|sh)\s+-c\b/i
];
const approved = [/^npm\s+run\b/i, /^yarn\b/i, /^pnpm\b/i, /^npx\s+(vitest|jest|tsc)\b/i, /^git\s+(status|diff|log)\b/i, /^(ls|dir|cat|type|echo)\b/i, /^node\s+-e\b/i];

export class PermissionGate {
  constructor(private readonly options: { interactive: boolean; dstackDir?: string | null }) {}
  async check(toolCall: ToolCall): Promise<PermissionDecision> {
    const staticDecision = decisionFor(toolCall);
    const mode = this.options.dstackDir ? await new SafetyModeManager({ dstackDir: this.options.dstackDir }).read() : normalMode();
    const decision = applySafetyMode(staticDecision, toolCall, mode);
    if (decision === "ALLOW" || decision === "DENY") return decision;
    if (!this.options.interactive) throw new PermissionError("Tool call requires approval in non-interactive mode", { tool: toolCall.name });
    const rl = readline.createInterface({ input, output });
    try {
      const answer = await rl.question(`DStack wants to run ${toolCall.name}: ${JSON.stringify(toolCall.input)}\nApprove? [y/N] `);
      return answer.trim().toLowerCase() === "y" ? "ALLOW" : "DENY";
    } finally {
      rl.close();
    }
  }
}

function applySafetyMode(staticDecision: PermissionDecision, toolCall: ToolCall, mode: SafetyMode): PermissionDecision {
  if (staticDecision === "DENY") return "DENY";
  if (mode.mode === "GUARD" && ["write", "execute", "destructive"].includes(permissionLevelFor(toolCall))) return "DENY";
  if (mode.mode === "CAREFUL") return "REQUIRE_APPROVAL";
  return staticDecision;
}

function decisionFor(toolCall: ToolCall): PermissionDecision {
  if (toolCall.name === "run_command") {
    const command = String(toolCall.input.command ?? "");
    if (destructive.some((pattern) => pattern.test(command))) return "DENY";
    if (/\bgit\s+(push|rebase|merge|tag)\b/i.test(command)) return "REQUIRE_APPROVAL";
    if (approved.some((pattern) => pattern.test(command.trim()))) return "ALLOW";
    return "REQUIRE_APPROVAL";
  }
  if (["write_file", "edit_file", "git_commit", "git_create_branch"].includes(toolCall.name)) return "REQUIRE_APPROVAL";
  if (toolCall.name === "browser_open" && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(String(toolCall.input.url ?? ""))) return "REQUIRE_APPROVAL";
  if (toolCall.name === "read_file" && /(^|[\\/])\.env(\..*)?$/i.test(String(toolCall.input.path ?? ""))) return "DENY";
  if (toolCall.name === "read_file" && /(^|[\\/])\.dstack[\\/]browser[\\/]sessions[\\/][^\\/]+[\\/]cookies\.json$/i.test(String(toolCall.input.path ?? ""))) return "DENY";
  return "ALLOW";
}

function permissionLevelFor(toolCall: ToolCall): PermissionLevel {
  if (toolCall.name === "run_command" || ["browser_open", "browser_click", "browser_type", "browser_close"].includes(toolCall.name)) return "execute";
  if (["write_file", "edit_file", "git_commit", "git_create_branch", "browser_screenshot"].includes(toolCall.name)) return "write";
  if (["read_file", "list_files", "find_files", "search_files", "find_symbol", "git_status", "git_diff", "git_log", "git_branch", "browser_snapshot", "browser_get_logs"].includes(toolCall.name)) return "read";
  return "execute";
}
