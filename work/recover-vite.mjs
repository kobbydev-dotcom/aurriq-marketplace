import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://01ktedkfybsdh4pveykrdp0b2z.hercules-dev.com";
const outRoot = process.cwd();
const seen = new Set();
const queued = ["/src/main.tsx?t=1780756277050", "/src/index.css"];

function cleanUrl(raw) {
  const url = new URL(raw, origin);
  url.search = "";
  return url.pathname;
}

function localPathFromSource(filePath, sourceName) {
  const normalized = filePath?.replaceAll("\\", "/") ?? "";
  const srcIndex = normalized.indexOf("/src/");
  if (srcIndex !== -1) {
    return normalized.slice(srcIndex + 1);
  }
  return sourceName?.startsWith("src/") ? sourceName : `src/${sourceName}`;
}

function extractSourceMap(text) {
  const marker = "sourceMappingURL=data:application/json;base64,";
  const index = text.lastIndexOf(marker);
  if (index === -1) return null;
  const encoded = text.slice(index + marker.length).trim();
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

function collectImports(text) {
  const imports = new Set();
  const patterns = [
    /(?:from\s+|import\s*\()\s*["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /url\(["']?([^)"']+)["']?\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const value = match[1];
      if (value.startsWith("/src/") || value.startsWith("/assets/")) {
        imports.add(value);
      }
    }
  }
  return [...imports];
}

async function saveFile(relativePath, content) {
  const target = path.join(outRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log(`wrote ${relativePath}`);
}

while (queued.length) {
  const next = queued.shift();
  const pathname = cleanUrl(next);
  if (seen.has(pathname)) continue;
  seen.add(pathname);

  const res = await fetch(new URL(next, origin));
  if (!res.ok) {
    console.warn(`skip ${next}: ${res.status}`);
    continue;
  }

  const text = await res.text();
  const map = extractSourceMap(text);

  if (map?.sourcesContent?.length) {
    for (let i = 0; i < map.sourcesContent.length; i += 1) {
      const sourceName = map.sources[i];
      const relativePath = localPathFromSource(map.file, sourceName);
      const content = map.sourcesContent[i];
      await saveFile(relativePath, content);
      queued.push(...collectImports(text), ...collectImports(content));
    }
  } else if (pathname.startsWith("/src/")) {
    await saveFile(pathname.slice(1), text);
    queued.push(...collectImports(text));
  }
}

console.log("recovery complete");
