import path from "node:path";
import { SkillRegistry } from "../packages/core/src/skills.js";

const definitionsDir = path.join(process.cwd(), "packages", "core", "src", "skills", "definitions");

try {
  const skills = await new SkillRegistry(definitionsDir).list();
  console.log(`Validated ${skills.length} DStack skill manifests.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
