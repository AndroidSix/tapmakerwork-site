import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChannel,
  buildSteamBoards,
  defaultDailyRange,
  flattenSnapshot,
  normalizeMakerApp,
  normalizeSteamItem,
  normalizeStoreApp,
  startOfLocalDay,
} from "../js/radar-core.js";

const TAP_HOST = "https://www.taptap.cn";
const STEAM_HOST = "https://store.steampowered.com";
const X_UA = "V=1&PN=WebApp&LANG=zh_CN&VN_CODE=100000000&LOC=CN&PLT=PC&DS=Android&UID=0&OS=MacOS&OSV=10.15.7&DT=PC";
const USER_AGENT = "TapMakerWork/0.1 (new-game-radar; +https://github.com/androidsix/TapMakerWork)";

const POOL_SPECS = [
  { id: "pool-hot", label: "制造综合池", sort: 1, from: 0, limit: 40 },
  { id: "pool-new", label: "制造新上池", sort: 2, from: 0, limit: 40 },
];

const DAILY_PAGE_SIZE = 40;
const DAILY_MAX_PAGES = 60;
const DAILY_CACHE_BUFFER_DAYS = 30;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

async function getJson(url, headers) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

function tapGetJson(pathnameWithQuery) {
  return getJson(`${TAP_HOST}${pathnameWithQuery}`, {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
    "X-UA": X_UA,
  });
}

async function fetchMakerEntries() {
  const seen = new Set();
  const entries = [];
  for (const spec of POOL_SPECS) {
    const query = `/webapiv2/maker/v1/app-list?sort=${spec.sort}&from=${spec.from}&limit=${spec.limit}&platform=android`;
    const payload = await tapGetJson(query);
    if (!payload.success) throw new Error(payload.data?.msg || "maker_list_failed");
    for (const [index, item] of (payload.data?.list || []).entries()) {
      const entry = normalizeMakerApp(item, spec.label, index + 1);
      if (!entry.id || seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  return entries;
}

function shortError(error) {
  const text = error instanceof Error ? error.message : String(error);
  const msg = text.match(/"msg":"([^"]+)"/);
  return (msg ? msg[1] : text).slice(0, 180);
}

async function fetchStoreEntries() {
  // 商店热门接口的 limit 上限是 15，分页凑满约 45 条作对照。
  const seen = new Set();
  const entries = [];
  let boardLabel = "商店热门";
  for (let page = 0; page < 3; page += 1) {
    const from = page * 15;
    const payload = await tapGetJson(`/webapiv2/app-top/v2/hits?type=hot&from=${from}&limit=15`);
    if (!payload.success) throw new Error(payload.data?.msg || "store_list_failed");
    boardLabel = String(payload.data?.title || boardLabel);
    const list = payload.data?.list || [];
    if (list.length === 0) break;
    for (const [index, item] of list.entries()) {
      const entry = normalizeStoreApp(item, boardLabel, from + index + 1);
      if (!entry.id || seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
    if (!payload.data?.next_page) break;
  }
  return entries;
}

async function fetchSteamChannel() {
  const payload = await getJson(`${STEAM_HOST}/api/featuredcategories/?l=schinese&cc=cn`, {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  });
  const topRaw = payload.top_sellers?.items || [];
  const newRaw = payload.new_releases?.items || [];
  const topSellers = topRaw.map((item, index) => normalizeSteamItem(item, "Steam 畅销", index + 1));
  const newReleases = newRaw.map((item, index) => normalizeSteamItem(item, "Steam 新品", index + 1));
  const seen = new Set();
  const entries = [];
  for (const entry of [...topSellers, ...newReleases]) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
  return buildChannel(
    "steam",
    "Steam 对照",
    "Valve 公开精选接口（畅销 / 新品），作全球独立与商业趋势对照；非国内小游戏榜。",
    entries,
    buildSteamBoards(topSellers, newReleases)
  );
}

async function fetchChannelSafe(id, label, description, runner) {
  try {
    const result = await runner();
    return buildChannel(id, label, description, result.entries, result.boards);
  } catch (error) {
    return buildChannel(id, label, description, [], undefined, shortError(error));
  }
}

async function fetchMakerLaunchesSince(sinceSec) {
  const seen = new Set();
  const entries = [];
  let truncated = false;
  for (let page = 0; page < DAILY_MAX_PAGES; page += 1) {
    const from = page * DAILY_PAGE_SIZE;
    const query = `/webapiv2/maker/v1/app-list?sort=2&from=${from}&limit=${DAILY_PAGE_SIZE}&platform=android`;
    const payload = await tapGetJson(query);
    if (!payload.success) throw new Error(payload.data?.msg || "maker_daily_failed");
    const list = payload.data?.list || [];
    if (list.length === 0) break;
    let oldest;
    for (const [index, item] of list.entries()) {
      const entry = normalizeMakerApp(item, "每日上线", from + index + 1);
      if (!entry.id || seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
      if (entry.releasedAt != null) oldest = oldest == null ? entry.releasedAt : Math.min(oldest, entry.releasedAt);
    }
    console.log(`daily page ${page + 1}: +${list.length}, pool ${entries.length}, oldest ${oldest || "-"}`);
    if (oldest != null && oldest < sinceSec) break;
    if (!payload.data?.next_page) break;
    if (page === DAILY_MAX_PAGES - 1) truncated = true;
  }
  return { entries, truncated };
}

function writeJson(fileName, value) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, fileName), `${JSON.stringify(value)}\n`, "utf8");
}

const [maker, store, steam] = await Promise.all([
  fetchChannelSafe("maker", "TapTap 制造", "制造综合池 + 新上池，本地推导热度榜 / 新锐榜。", async () => ({
    entries: await fetchMakerEntries(),
  })),
  fetchChannelSafe("store", "TapTap 商店", "商店公开热门榜（app-top/v2/hits）。官方 type 目前均落热门，作全站对照。", async () => ({
    entries: await fetchStoreEntries(),
  })),
  fetchChannelSafe("steam", "Steam 对照", "Valve 公开精选接口（畅销 / 新品）。", async () => {
    const channel = await fetchSteamChannel();
    return { entries: channel.entries, boards: channel.boards };
  }),
]);

const channels = [maker, store, steam];
const errors = channels.filter((channel) => channel.error).map((channel) => `${channel.label}: ${channel.error}`);
if (channels.every((channel) => channel.entries.length === 0)) {
  console.error(errors.join("；") || "all_channels_failed");
  process.exit(1);
}

const fetchedAt = new Date().toISOString();
const snapshot = flattenSnapshot(fetchedAt, "live", channels, errors.length ? errors.join("；") : undefined);
writeJson("radar-snapshot.json", snapshot);

const range = defaultDailyRange(DAILY_CACHE_BUFFER_DAYS);
const sinceSec = startOfLocalDay(range.from);
let launches;
try {
  const result = await fetchMakerLaunchesSince(sinceSec);
  launches = {
    fetchedAt,
    source: "live",
    sinceSec,
    from: range.from,
    to: range.to,
    truncated: result.truncated,
    entries: result.entries,
  };
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
writeJson("radar-launches.json", launches);

for (const channel of channels) {
  console.log(`${channel.label}: ${channel.entries.length} entries${channel.error ? ` ERROR ${channel.error}` : ""}`);
}
console.log(`launches: ${launches.entries.length} since ${launches.from}${launches.truncated ? " truncated" : ""}`);
console.log(`wrote ${dataDir}`);
