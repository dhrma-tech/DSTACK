import { ConfigManager, DeployManager, SafetyModeManager, SkillAuditor, SkillExecutor, shortHash, startDstackApiServer } from "@dstack/core";
import type { ParsedCommand } from "./parser.js";
import { helpText, resultText, skillCheckText, skillsText, versionText, type RuntimeStatus, skillsJson, skillCheckJson, resultJson } from "./printer.js";

export async function route(command: ParsedCommand): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (command.help) return { stdout: helpText(), stderr: "", exitCode: 0 };
  if (command.version) return { stdout: versionText("0.1.0"), stderr: "", exitCode: 0 };
  
  const projectRoot = command.invocation?.projectRoot ?? process.cwd();
  
  // Handle serve command
  if (command.serve) {
    return await handleServeCommand(command, projectRoot);
  }
  const config = await ConfigManager.load({
    projectRoot,
    cliModel: command.invocation?.flags.model ?? null,
    cliProvider: command.invocation?.flags.provider ?? null,
    allowSecrets: command.invocation?.flags.allowSecrets ?? false
  });
  const executor = new SkillExecutor({ config, interactive: true });
  
  // Handle JSON output for list-skills
  if (command.listSkills) {
    if (command.json) {
      const skills = await executor.listSkills();
      const envelope = skillsJson(skills);
      return { stdout: JSON.stringify(envelope, null, 0), stderr: "", exitCode: 0 };
    }
    return { stdout: skillsText(await executor.listSkills()), stderr: "", exitCode: 0 };
  }
  
  // Handle JSON output for skill-check
  if (command.skillCheck) {
    const report = await new SkillAuditor().audit();
    if (command.json) {
      const envelope = skillCheckJson(report);
      return { stdout: JSON.stringify(envelope, null, 0), stderr: "", exitCode: report.passed ? 0 : 1 };
    }
    return { stdout: skillCheckText(report), stderr: "", exitCode: report.passed ? 0 : 1 };
  }
  
  // Handle skill invocation
  if (!command.invocation) return { stdout: helpText(), stderr: "", exitCode: 0 };
  
  try {
    const result = await executor.run(command.invocation);
    
    if (command.json) {
      const envelope = resultJson(result, { 
        provider: config.provider, 
        includeOutput: true, 
        runtimeStatus: await runtimeStatus(config.projectRoot, config.dstackDir),
        projectId: shortHash(config.projectRoot, 12) 
      });
      return { stdout: JSON.stringify(envelope, null, 0), stderr: "", exitCode: 0 };
    }
    
    return { stdout: resultText(result, { provider: config.provider, includeOutput: command.verbose, runtimeStatus: await runtimeStatus(config.projectRoot, config.dstackDir) }), stderr: "", exitCode: 0 };
  } catch (error) {
    if (command.json) {
      const envelope = {
        ok: false,
        data: null,
        warnings: [],
        error: {
          code: error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : 'SKILL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: false,
          requestId: 'skill-error-' + Date.now()
        },
        meta: {
          requestId: 'skill-error-' + Date.now(),
          timestamp: new Date().toISOString(),
          apiVersion: 'v1',
          command: `/${command.invocation?.skillName || 'unknown'}`,
          projectId: shortHash(config.projectRoot, 12)
        }
      };
      return { stdout: JSON.stringify(envelope, null, 0), stderr: "", exitCode: 1 };
    } else {
      return { stdout: "", stderr: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, exitCode: 1 };
    }
  }
}

async function handleServeCommand(command: ParsedCommand, projectRoot: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const serverOptions = {
      projectRoot,
      ...(command.serveOptions?.host && { host: command.serveOptions.host }),
      ...(command.serveOptions?.port && { port: command.serveOptions.port }),
      ...(command.serveOptions?.tokenFile && { tokenFile: command.serveOptions.tokenFile }),
      ...(command.serveOptions?.allowAbsolutePaths !== undefined && { allowAbsolutePaths: command.serveOptions.allowAbsolutePaths })
    };
    
    const serverInfo = await startDstackApiServer(serverOptions);

    if (command.json) {
      const envelope = {
        ok: true,
        data: {
          serverUrl: serverInfo.baseUrl,
          host: serverInfo.host,
          port: serverInfo.port,
          tokenFile: serverInfo.tokenFileRelative,
          message: "Server started successfully"
        },
        warnings: [{
          code: "LOCALHOST_ONLY",
          message: "Server is bound to localhost only for security",
          severity: "info" as const
        }],
        error: null,
        meta: {
          requestId: "serve-" + Date.now(),
          timestamp: new Date().toISOString(),
          apiVersion: "v1",
          command: "serve"
        }
      };
      
      return { stdout: JSON.stringify(envelope, null, 0), stderr: "", exitCode: 0 };
    } else {
      const output = [
        "🚀 DStack API Server Started",
        "",
        `Local URL: ${serverInfo.baseUrl}`,
        `Host: ${serverInfo.host}`,
        `Port: ${serverInfo.port}`,
        `Token File: ${serverInfo.tokenFileRelative}`,
        "",
        "⚠️  Server is localhost-only for security",
        "📝 Use the token in .dstack/api/token for authentication",
        "",
        "Press Ctrl+C to stop the server"
      ].join("\n");

      // In non-JSON mode, we should keep the server running
      // For now, return the startup info and exit
      return { stdout: output, stderr: "", exitCode: 0 };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error starting server";
    if (command.json) {
      const envelope = {
        ok: false,
        data: null,
        warnings: [],
        error: {
          code: "SERVER_START_FAILED",
          message: errorMessage,
          retryable: false,
          requestId: "serve-" + Date.now()
        },
        meta: {
          requestId: "serve-" + Date.now(),
          timestamp: new Date().toISOString(),
          apiVersion: "v1",
          command: "serve"
        }
      };
      
      return { stdout: JSON.stringify(envelope, null, 0), stderr: "", exitCode: 1 };
    } else {
      return { stdout: "", stderr: `Failed to start server: ${errorMessage}`, exitCode: 1 };
    }
  }
}

async function runtimeStatus(projectRoot: string, dstackDir: string): Promise<RuntimeStatus> {
  const safety = await new SafetyModeManager({ dstackDir }).read();
  const freeze = await new DeployManager({ projectRoot, dstackDir }).readState();
  return { safetyMode: safety.mode, deployFrozen: freeze.frozen, deployFreezeReason: freeze.reason };
}
