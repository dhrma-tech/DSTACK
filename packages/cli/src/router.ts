import { ConfigManager, SkillAuditor, SkillExecutor } from "@dstack/core";
import type { ParsedCommand } from "./parser.js";
import { helpText, resultText, skillCheckText, skillsText, versionText } from "./printer.js";

export async function route(command: ParsedCommand): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (command.help) return { stdout: helpText(), stderr: "", exitCode: 0 };
  if (command.version) return { stdout: versionText("0.1.0"), stderr: "", exitCode: 0 };
  const projectRoot = command.invocation?.projectRoot ?? process.cwd();
  const config = await ConfigManager.load({
    projectRoot,
    cliModel: command.invocation?.flags.model ?? null,
    cliProvider: command.invocation?.flags.provider ?? null,
    allowSecrets: command.invocation?.flags.allowSecrets ?? false
  });
  const executor = new SkillExecutor({ config, interactive: true });
  if (command.listSkills) return { stdout: skillsText(await executor.listSkills()), stderr: "", exitCode: 0 };
  if (command.skillCheck) {
    const report = await new SkillAuditor().audit();
    return { stdout: skillCheckText(report), stderr: "", exitCode: report.passed ? 0 : 1 };
  }
  if (!command.invocation) return { stdout: helpText(), stderr: "", exitCode: 0 };
  return { stdout: resultText(await executor.run(command.invocation), { provider: config.provider, includeOutput: command.json || command.verbose }), stderr: "", exitCode: 0 };
}
