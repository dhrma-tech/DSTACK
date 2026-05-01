import path from "node:path";
import { SkillAuditor } from "../packages/core/src/skills/audit.js";

const definitionsDir = path.join(process.cwd(), "packages", "core", "src", "skills", "definitions");

try {
  const report = await new SkillAuditor({ definitionsDir }).audit();
  console.log(`Validated ${report.totalSkills} DStack skill manifests.`);
  if (report.warnings.length > 0) {
    console.log(`Warnings: ${report.warnings.length}`);
    for (const warning of report.warnings) console.log(`- /${warning.skillName} [${warning.check}] ${warning.message}`);
  }
  if (!report.passed) {
    for (const error of report.errors) console.error(`- /${error.skillName} [${error.check}] ${error.message}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
