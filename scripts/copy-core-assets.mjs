import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "packages", "core", "src", "skills", "definitions");
const target = path.join(root, "packages", "core", "dist", "skills", "definitions");

await mkdir(target, { recursive: true });
await cp(source, target, {
  recursive: true,
  filter: (sourcePath) => sourcePath.endsWith(".yaml") || sourcePath.endsWith(".md") || !path.extname(sourcePath)
});
