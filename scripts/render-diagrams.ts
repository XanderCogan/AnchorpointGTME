// Renders every mermaid block in docs/portfolio/diagrams.md to an SVG under docs/portfolio/diagrams/.
// Usage: npm run diagrams
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, renameSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = resolve("docs/portfolio/diagrams.md");
const outDir = resolve("docs/portfolio/diagrams");
const names = ["system-overview", "data-pipeline", "attio-object-model", "activation-state-machine"];

const tmp = mkdtempSync(join(tmpdir(), "diagrams-"));
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["--yes", "@mermaid-js/mermaid-cli", "-i", source, "-o", join(tmp, "out.md"), "-b", "white"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

mkdirSync(outDir, { recursive: true });
const svgs = readdirSync(tmp).filter((f) => f.endsWith(".svg")).sort();
if (svgs.length !== names.length) {
  throw new Error(`expected ${names.length} charts, mermaid-cli produced ${svgs.length}`);
}
svgs.forEach((file, index) => renameSync(join(tmp, file), join(outDir, `${names[index]}.svg`)));
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${svgs.length} diagrams to ${outDir}`);
