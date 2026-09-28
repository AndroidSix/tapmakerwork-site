import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "AndroidSix";
const REPO = "TapMakerWork";
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

const PLAT_PATTERNS = [
  { key: "mac-arm64", re: /mac-arm64\.pkg$/i },
  { key: "mac-x64", re: /mac-x64\.pkg$/i },
  { key: "windows-x64", re: /windows-x64\.exe$/i },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "data", "release.json");

function stripV(tag) {
  return String(tag || "").replace(/^v/i, "");
}

function pickAssets(assets) {
  const out = {};
  for (const { key, re } of PLAT_PATTERNS) {
    const hit = (assets || []).find((a) => re.test(a.name || ""));
    if (!hit) continue;
    out[key] = {
      file: hit.name,
      url: hit.browser_download_url,
    };
  }
  return out;
}

async function fetchLatest() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "TapMakerWork-site-sync-release",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(API_URL, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function buildPayload(release) {
  const tag = release.tag_name;
  const assets = pickAssets(release.assets);
  const missing = PLAT_PATTERNS.map((p) => p.key).filter((k) => !assets[k]);
  if (missing.length) {
    throw new Error(`Release ${tag} missing assets: ${missing.join(", ")}`);
  }

  return {
    tag,
    version: stripV(tag),
    url: release.html_url,
    name: release.name || tag,
    publishedAt: release.published_at || null,
    syncedAt: new Date().toISOString(),
    assets,
  };
}

function normalizeForCompare(data) {
  const copy = structuredClone(data);
  delete copy.syncedAt;
  return JSON.stringify(copy, null, 2);
}

async function main() {
  const release = await fetchLatest();
  const next = buildPayload(release);

  let prev = null;
  if (fs.existsSync(outPath)) {
    prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
  }

  const changed = !prev || normalizeForCompare(prev) !== normalizeForCompare(next);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  console.log(`Synced ${next.tag} → ${path.relative(root, outPath)}`);
  console.log(changed ? "CHANGED=1" : "CHANGED=0");
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed ? "true" : "false"}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${next.tag}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
