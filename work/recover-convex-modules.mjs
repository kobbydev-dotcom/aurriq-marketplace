import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://01ktedkfybsdh4pveykrdp0b2z.hercules-dev.com";
const root = process.cwd();
const modules = [
  "admin",
  "cart",
  "inventory",
  "messages",
  "orders",
  "products",
  "reports",
  "users",
  "schema",
];

function extractFirstSource(text) {
  const marker = "sourceMappingURL=data:application/json;base64,";
  const index = text.lastIndexOf(marker);
  if (index === -1) return text;
  const map = JSON.parse(
    Buffer.from(text.slice(index + marker.length).trim(), "base64").toString("utf8"),
  );
  return map.sourcesContent?.[0] ?? text;
}

async function save(relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log(`wrote ${relativePath}`);
}

for (const mod of modules) {
  const res = await fetch(new URL(`/convex/${mod}.js`, origin));
  if (!res.ok) {
    console.warn(`skip ${mod}: ${res.status}`);
    continue;
  }
  await save(`src/convex/${mod}.ts`, extractFirstSource(await res.text()));
}
