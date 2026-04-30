#!/usr/bin/env node
import { parseArgv } from "./parser.js";
import { errorText } from "./printer.js";
import { route } from "./router.js";

try {
  const result = await route(await parseArgv());
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.exitCode;
} catch (error) {
  process.stderr.write(`${errorText(error)}\n`);
  process.exitCode = 1;
}
