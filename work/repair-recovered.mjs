import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function write(relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log(`wrote ${relativePath}`);
}

function extractCssFromViteModule(text) {
  const match = text.match(/const __vite__css = "([\s\S]*?)"\r?\n__vite__updateStyle/);
  if (!match) return text;
  return JSON.parse(`"${match[1]}"`);
}

function extractFirstSource(text) {
  const marker = "sourceMappingURL=data:application/json;base64,";
  const index = text.lastIndexOf(marker);
  if (index === -1) return text;
  const encoded = text.slice(index + marker.length).trim();
  const map = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  return map.sourcesContent?.[0] ?? text;
}

function normalizeText(text) {
  return text
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-")
    .replaceAll("â", "-")
    .replaceAll("â", "-")
    .replaceAll("â", "'")
    .replaceAll("â", '"')
    .replaceAll("â", '"')
    .replaceAll("â¡", "⚡");
}

const cssModule = await readFile(path.join(root, "src/index.css"), "utf8");
await write("src/index.css", normalizeText(extractCssFromViteModule(cssModule)));

await mkdir(path.join(root, "src/lib"), { recursive: true });
await mkdir(path.join(root, "src/hooks"), { recursive: true });
await copyFile(path.join(root, "src/utils.ts"), path.join(root, "src/lib/utils.ts"));
await copyFile(path.join(root, "src/use-auth.ts"), path.join(root, "src/hooks/use-auth.ts"));
await copyFile(path.join(root, "src/use-debounce.ts"), path.join(root, "src/hooks/use-debounce.ts"));
console.log("wrote alias helper files");

const origin = "https://01ktedkfybsdh4pveykrdp0b2z.hercules-dev.com";
const files = [
  ["/src/components/ui/progress.tsx?t=1780756277050", "src/components/ui/progress.tsx"],
  ["/convex/_generated/api.js", "src/convex/_generated/api.js"],
  ["/convex/_generated/dataModel.d.ts", "src/convex/_generated/dataModel.d.ts"],
];

for (const [remote, local] of files) {
  const res = await fetch(new URL(remote, origin));
  if (!res.ok) throw new Error(`${remote}: ${res.status}`);
  const source = extractFirstSource(await res.text())
    .replace('from "/node_modules/.vite/deps/convex_server.js?v=5c695bee"', 'from "convex/server"');
  await write(local, normalizeText(source));
}
