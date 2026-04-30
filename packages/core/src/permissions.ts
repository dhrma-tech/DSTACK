import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PermissionError, type PermissionDecision, type ToolCall } from "@dstack/shared";

const destructive = [/\brm\s+-rf\b/i, /\bsudo\b/i, /\bcurl\b.*\|\s*(bash|sh)\b/i, /\bwget\b.*\|\s*(bash|sh)\b/i, /\beval\b/i, /\bdd\s+if=/i, /\bmkfs\b/i];
const approved = [/^npm\s+run\b/i, /^yarn\b/i, /^pnpm\b/i, /^npx\s+(vitest|jest|tsc)\b/i, /^git\s+(status|diff|log)\b/i, /^(ls|dir|cat|type|echo)\b/i, /^node\s+-e\b/i];

export class PermissionGate {
  constructor(private readonly options: { interactive: boolean }) {}
  async check(toolCall: ToolCall): Promise<PermissionDecision> {
    const staticDecision = decisionFor(toolCall);
    if (staticDecision === "ALLOW" || staticDecision === "DENY") return staticDecision;
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

function decisionFor(toolCall: ToolCall): PermissionDecision {
  if (toolCall.name === "run_command") {
    const command = String(toolCall.input.command ?? "");
    if (destructive.some((pattern) => pattern.test(command))) return "DENY";
    if (approved.some((pattern) => pattern.test(command.trim()))) return "ALLOW";
    return "REQUIRE_APPROVAL";
  }
  if (["write_file", "edit_file", "git_commit", "git_create_branch", "browser_screenshot"].includes(toolCall.name)) return "REQUIRE_APPROVAL";
  if (toolCall.name === "browser_open" && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(String(toolCall.input.url ?? ""))) return "REQUIRE_APPROVAL";
  if (toolCall.name === "read_file" && /(^|[\\/])\.env(\..*)?$/i.test(String(toolCall.input.path ?? ""))) return "DENY";
  return "ALLOW";
}
