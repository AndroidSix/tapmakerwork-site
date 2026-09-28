import {
  QUADRANT_GUIDE,
  SCORE_BUCKET_META,
  buildDailyReport,
  dayKeyFromTs,
  defaultDailyRange,
  matchesQuery,
  sortRadarEntries,
} from "./radar-core.js";

const CHART_COLORS = ["#7c3aed", "#ec4899", "#0f766e", "#d97706", "#0284c7", "#4f46e5", "#db2777", "#0369a1", "#b45309", "#0e7490"];

const TABS = [
  ["list", "榜单明细"],
  ["daily", "每日上线"],
  ["insight", "雷达洞察"],
  ["analysis", "分析台"],
  ["viz", "可视化"],
];

const SORTS = [
  ["hits-desc", "热度从高到低"],
  ["hits-asc", "热度从低到高"],
  ["score-desc", "评分从高到低"],
  ["score-asc", "评分从低到高"],
];

const initialRange = defaultDailyRange(7);

const state = {
  snapshot: null,
  launches: null,
  loadError: "",
  channelId: "maker",
  mainTab: "list",
  analysisSub: "tracks",
  vizSub: "distribution",
  boardFilter: "heat",
  listSort: "hits-desc",
  chartStyle: "hbar",
  query: "",
  dailyFrom: initialRange.from,
  dailyTo: initialRange.to,
  dailyExpanded: false,
};

const view = document.getElementById("radar-view");
const meta = document.getElementById("radar-meta");
const status = document.getElementById("radar-status");
const channelsNav = document.getElementById("radar-channels");
const channelDesc = document.getElementById("radar-channel-desc");
const dailyControls = document.getElementById("radar-daily-controls");
const tip = document.getElementById("radar-tip");

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHttps(url, allowHost) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    if (!allowHost(parsed.hostname)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function gameHref(entry) {
  const url =
    entry.url ||
    (entry.channel === "steam" && entry.id > 0 ? `https://store.steampowered.com/app/${entry.id}` : "") ||
    (entry.id > 0 ? `https://www.taptap.cn/app/${entry.id}` : "");
  return safeHttps(url, (host) => host === "www.taptap.cn" || host === "store.steampowered.com");
}

function authorHref(entry) {
  if (entry.channel === "steam") return "";
  const url = entry.authorUrl || (entry.authorId != null ? `https://www.taptap.cn/developer/${entry.authorId}` : "");
  return safeHttps(url, (host) => host === "www.taptap.cn");
}

function iconHref(url) {
  return safeHttps(
    url,
    (host) => host.endsWith(".tapimg.com") || host.endsWith(".steamstatic.com") || host.endsWith(".akamaihd.net")
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatNum(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("zh-CN");
}

function quadrantClass(quadrant) {
  if (quadrant === "巨头垄断" || quadrant === "红海拥挤") return "radar-bad";
  if (quadrant === "蓝海空白") return "radar-good";
  return "radar-mid";
}

function channels() {
  return state.snapshot?.channels || [];
}

function currentChannel() {
  return channels().find((item) => item.id === state.channelId) || channels()[0] || null;
}

function link(href, text) {
  if (!href) return esc(text);
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
}

function gameCell(entry) {
  const href = gameHref(entry);
  const icon = iconHref(entry.iconUrl);
  const initial = esc((entry.title || "?").slice(0, 1));
  const iconHtml = icon
    ? `<span class="radar-icon-slot"><img class="radar-icon" src="${esc(icon)}" alt="" width="36" height="36" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="radar-icon-fallback" hidden>${initial}</span></span>`
    : `<span class="radar-icon-fallback" aria-hidden="true">${initial}</span>`;
  const labels = entry.labels?.length ? `<small class="radar-labels">${esc(entry.labels.join(" · "))}</small>` : "";
  const title = href ? link(href, entry.title) : `<strong>${esc(entry.title)}</strong>`;
  const iconLink = href
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${esc(entry.title)} 的商店页">${iconHtml}</a>`
    : iconHtml;
  return `<div class="radar-game">${iconLink}<div>${title}${labels}</div></div>`;
}

function authorCell(entry) {
  const href = authorHref(entry);
  return href ? link(href, entry.author) : esc(entry.author);
}

function chips(items, attr, current) {
  return items
    .map(
      ([id, label]) =>
        `<button type="button" class="radar-chip" data-${attr}="${esc(id)}" aria-pressed="${current === id ? "true" : "false"}">${esc(label)}</button>`
    )
    .join("");
}

function tableWrap(caption, head, rows) {
  return `<div class="radar-table-wrap">
      <table class="radar-table">
        <caption>${esc(caption)}。列较多时可以横向滑动。</caption>
        <thead><tr>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function emptyRow(colSpan, text) {
  return `<tr><td colspan="${colSpan}">${esc(text)}</td></tr>`;
}

function activeBoard(channel) {
  if (!channel) return null;
  if (state.boardFilter === "heat") return channel.boards.find((board) => board.id === "heat") || null;
  if (state.boardFilter === "rising") return channel.boards.find((board) => board.id === "rising") || null;
  return null;
}

function filteredEntries(channel) {
  const source = activeBoard(channel)?.entries || channel.entries;
  return sortRadarEntries(source.filter((entry) => matchesQuery(entry, state.query)), state.listSort);
}

function renderList(channel) {
  const isSteam = channel.id === "steam";
  const heatLabel = isSteam ? "畅销榜" : "热度榜";
  const risingLabel = isSteam ? "新品榜" : "新锐榜";
  const showRising = state.boardFilter === "rising" && !isSteam;
  const board = activeBoard(channel);
  const entries = filteredEntries(channel);
  const heatName = isSteam ? "伪热度" : "热度";
  let note = "";
  if (board?.description) note = board.description;
  else if (state.boardFilter === "all" && !isSteam) {
    note = "全部样本用于赛道分析。热度榜按曝光排序；新锐榜按口碑平方、热度对数与评论可信度，并对超高热度做抑制。";
  } else if (state.boardFilter === "all" && isSteam) {
    note = "Steam 样本来自公开畅销 / 新品精选，没有评分字段，只作题材对照。";
  }
  const rows = entries.length
    ? entries
        .map(
          (entry) => `<tr>
            <td>${esc(entry.rank)}</td>
            <td>${gameCell(entry)}</td>
            <td>${authorCell(entry)}</td>
            <td>${esc(entry.tags.join(" / ") || "—")}</td>
            <td>${formatNum(entry.hits)}</td>
            <td>${entry.score ?? "—"}</td>
            ${showRising ? `<td>${entry.risingScore ?? "—"}</td>` : ""}
            <td>${formatNum(entry.reviewCount)}</td>
            <td>${esc(entry.board)}</td>
          </tr>`
        )
        .join("")
    : emptyRow(showRising ? 9 : 8, `没有匹配「${state.query || "当前榜单"}」的游戏`);
  return `<div class="radar-subtabs" role="group" aria-label="榜单类型">
      ${chips(
        [
          ["heat", heatLabel],
          ["rising", risingLabel],
          ["all", "全部样本"],
        ],
        "board",
        state.boardFilter
      )}
    </div>
    <div class="radar-subtabs" role="group" aria-label="列表排序">${chips(SORTS, "sort", state.listSort)}</div>
    ${note ? `<p class="radar-note">${esc(note)}</p>` : ""}
    ${tableWrap(
      "榜单明细",
      `<th scope="col">#</th><th scope="col">游戏</th><th scope="col">作者</th><th scope="col">标签</th><th scope="col">${heatName}</th><th scope="col">评分</th>${showRising ? "<th scope=\"col\">新锐分</th>" : ""}<th scope="col">评论</th><th scope="col">榜单</th>`,
      rows
    )}`;
}

function dailyReport() {
  if (!state.launches) return null;
  return buildDailyReport(state.launches.entries || [], state.dailyFrom, state.dailyTo, {
    fetchedAt: state.launches.fetchedAt,
    source: state.launches.source,
    truncated: state.launches.truncated,
    error: state.launches.error,
  });
}

function renderDaily() {
  const report = dailyReport();
  if (!report) return `<p class="radar-message">每日上线样本还没准备好。</p>`;
  const hottest = report.highlights.hottest;
  const best = report.highlights.bestScore;
  const entries = sortRadarEntries(
    report.entries.filter((entry) => matchesQuery(entry, state.query)),
    state.listSort
  );
  const visibleEntries = state.dailyExpanded ? entries : entries.slice(0, 40);
  const dayRows = [...report.byDay]
    .reverse()
    .map(
      (day) => `<tr>
        <td>${esc(day.date)}</td>
        <td>${formatNum(day.count)}</td>
        <td>${formatNum(day.totalHits)}</td>
        <td>${esc(day.topTitle || "—")}</td>
        <td>${day.topScore ?? "—"}</td>
      </tr>`
    )
    .join("");
  const listRows = visibleEntries.length
    ? visibleEntries
        .map(
          (entry, index) => `<tr>
            <td>${index + 1}</td>
            <td>${gameCell(entry)}</td>
            <td>${authorCell(entry)}</td>
            <td>${entry.releasedAt != null ? esc(dayKeyFromTs(entry.releasedAt)) : "—"}</td>
            <td>${esc(entry.tags.join(" / ") || "—")}</td>
            <td>${formatNum(entry.hits)}</td>
            <td>${entry.score ?? "—"}</td>
            <td>${formatNum(entry.reviewCount)}</td>
          </tr>`
        )
        .join("")
    : emptyRow(8, `该范围内没有匹配「${state.query || "全部"}」的上线游戏`);
  const warn = report.truncated ? `<p class="radar-message">样本分页已到上限，更早日期可能不完整。请把范围收在近 30 天内。</p>` : "";
  return `${warn}
    <div class="radar-stats">
      <article class="radar-stat"><em>上线数</em><strong>${formatNum(report.total)}</strong><span>已开分 ${formatNum(report.scoredCount)}</span></article>
      <article class="radar-stat"><em>均分</em><strong>${report.avgScore ?? "—"}</strong><span>总热度 ${formatNum(report.totalHits)}</span></article>
      <article class="radar-stat"><em>最热</em><strong>${hottest ? link(gameHref(hottest), hottest.title) : "—"}</strong><span>热度 ${hottest ? formatNum(hottest.hits) : "—"} · 评分 ${hottest?.score ?? "—"}</span></article>
      <article class="radar-stat"><em>最高分</em><strong>${best ? link(gameHref(best), best.title) : "—"}</strong><span>评分 ${best?.score ?? "—"} · 评论 ${best ? formatNum(best.reviewCount) : "—"}</span></article>
    </div>
    <div class="radar-insight">
      <section class="radar-insight-card">
        <h2>热度 Top 5</h2>
        <ol>${report.topByHits
          .slice(0, 5)
          .map(
            (entry) =>
              `<li>${link(gameHref(entry), entry.title)}<span>热度 ${formatNum(entry.hits)} · 评分 ${entry.score ?? "—"} · ${esc(entry.tags.join(" / ") || "未分类")}</span></li>`
          )
          .join("") || "<li>暂无</li>"}</ol>
      </section>
      <section class="radar-insight-card">
        <h2>赛道 Top 5</h2>
        <ol>${report.topTracks
          .slice(0, 5)
          .map((row) => `<li><strong>${esc(row.track)}</strong><span>${formatNum(row.count)} 款 · 热度 ${formatNum(row.totalHits)} · 均分 ${row.avgScore ?? "—"}</span></li>`)
          .join("") || "<li>暂无</li>"}</ol>
      </section>
    </div>
    ${tableWrap("逐日上线", "<th scope=\"col\">日期</th><th scope=\"col\">上线</th><th scope=\"col\">日热度</th><th scope=\"col\">当日最热</th><th scope=\"col\">评分</th>", dayRows || emptyRow(5, "该范围没有上线记录"))}
    <div class="radar-subtabs" role="group" aria-label="列表排序">${chips(SORTS, "sort", state.listSort)}</div>
    ${tableWrap(
      "上线明细",
      "<th scope=\"col\">#</th><th scope=\"col\">游戏</th><th scope=\"col\">作者</th><th scope=\"col\">上线日</th><th scope=\"col\">标签</th><th scope=\"col\">热度</th><th scope=\"col\">评分</th><th scope=\"col\">评论</th>",
      listRows
    )}
    ${
      entries.length > visibleEntries.length
        ? `<p><button type="button" class="btn btn-secondary btn-sm" data-expand="daily">展开其余 ${entries.length - visibleEntries.length} 条</button></p>`
        : ""
    }`;
}

function renderInsight(channel) {
  const crowded = [...channel.tracks].sort((a, b) => b.supplySaturation - a.supplySaturation).slice(0, 3);
  const top = channel.tracks.slice(0, 3);
  const list = (rows, line) =>
    rows.length
      ? rows
          .map(
            (row) =>
              `<li><strong class="${quadrantClass(row.quadrant)}">${esc(row.track)}</strong><span>${line(row)}</span></li>`
          )
          .join("")
      : "<li>样本不足</li>";
  return `<div class="radar-insight">
      <section class="radar-insight-card">
        <h2>机会 Top 3</h2>
        <ol>${list(top, (row) => `机会 ${row.opportunity} · ${esc(row.quadrant)} · ${esc(row.suggestion)}`)}</ol>
      </section>
      <section class="radar-insight-card">
        <h2>拥挤赛道</h2>
        <ol>${list(crowded, (row) => `供给 ${row.supplySaturation.toFixed(2)} · 头部 ${row.headOccupancy.toFixed(2)} · ${esc(row.suggestion)}`)}</ol>
      </section>
    </div>
    <p class="radar-note">象限同时用文字标出。供给饱和是赛道作品量相对最高赛道，头部占据是第一名热度占赛道热度的比例。</p>`;
}

function renderAnalysis(channel) {
  const rows = (state.analysisSub === "opportunity" ? [...channel.tracks].sort((a, b) => b.opportunity - a.opportunity) : [...channel.tracks].sort((a, b) => b.count - a.count))
    .map(
      (row) => `<tr>
        <td>${esc(row.track)}</td>
        <td class="${quadrantClass(row.quadrant)}">${esc(row.quadrant)}</td>
        <td>${esc(row.lifecycle)}</td>
        <td>${formatNum(row.count)}</td>
        <td>${row.supplySaturation.toFixed(2)}</td>
        <td>${row.headOccupancy.toFixed(2)}</td>
        <td>${row.smoothOccupancy.toFixed(2)}</td>
        <td>${row.avgScore ?? "—"}</td>
        <td><strong>${row.opportunity}</strong></td>
        <td class="${quadrantClass(row.quadrant)}">${esc(row.suggestion)}</td>
      </tr>`
    )
    .join("");
  return `<div class="radar-subtabs" role="group" aria-label="分析子视图">
      ${chips(
        [
          ["opportunity", "机会分排行"],
          ["tracks", "赛道竞争"],
        ],
        "analysis",
        state.analysisSub
      )}
    </div>
    <div class="radar-quadrant-head">
      <h2 class="radar-block-title">象限说明</h2>
      <p>横轴是供给饱和，纵轴是头部占据。颜色只是辅助，每个象限都写了含义和建议。</p>
    </div>
    <div class="radar-quadrant-grid">
      ${QUADRANT_GUIDE.map(
        (item) => `<article class="radar-quadrant tone-${item.tone}">
          <strong class="${quadrantClass(item.quadrant)}">${esc(item.quadrant)}</strong>
          <em>${esc(item.summary)}</em>
          <p>${esc(item.meaning)}</p>
          <small>坐标：${esc(item.axis)}</small>
          <small>建议：${esc(item.action)}</small>
        </article>`
      ).join("")}
    </div>
    ${tableWrap(
      "赛道分析",
      "<th scope=\"col\">赛道</th><th scope=\"col\">象限</th><th scope=\"col\">生命周期</th><th scope=\"col\">条数</th><th scope=\"col\">供给饱和</th><th scope=\"col\">头部占据</th><th scope=\"col\">平滑占据</th><th scope=\"col\">均分</th><th scope=\"col\">机会指数</th><th scope=\"col\">建议</th>",
      rows || emptyRow(10, "当前渠道没有可分析样本")
    )}
    <p class="radar-note">样本很少的赛道仍会列出，建议回到榜单明细里人工复核。</p>`;
}

function scoreChartData(channel) {
  const buckets = (channel.scoreBuckets || []).map((bucket) => {
    const metaInfo = SCORE_BUCKET_META[bucket.label];
    return {
      label: metaInfo?.title || bucket.label,
      value: bucket.count,
      detail: metaInfo?.detail || `评分区间 ${bucket.label}`,
    };
  });
  const unrated = channel.entries.filter((entry) => entry.score == null).length;
  if (unrated > 0) {
    buckets.push({
      label: SCORE_BUCKET_META["未开分"].title,
      value: unrated,
      detail: SCORE_BUCKET_META["未开分"].detail,
    });
  }
  return buckets;
}

function supplyChartData(channel) {
  return [...(channel.tracks || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((row) => ({
      label: row.track,
      value: row.count,
      detail: `${row.quadrant} · ${row.lifecycle} · 机会指数 ${row.opportunity}`,
      note: row.avgScore != null ? `均分 ${row.avgScore}` : "",
    }));
}

function chartSummary(item, total) {
  const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
  return [item.label, item.detail, `数量 ${item.value}`, `占比 ${percent}%`, item.note].filter(Boolean).join("。");
}

function renderHBar(title, data) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const rows = data
    .map((item, index) => {
      const summary = chartSummary(item, total);
      return `<div class="radar-bar-row" tabindex="0" data-tip="${esc(summary)}">
        <span class="radar-bar-label">${esc(item.label)}</span>
        <div class="radar-bar-track" aria-hidden="true"><i style="width:${(item.value / max) * 100}%;background:${CHART_COLORS[index % CHART_COLORS.length]}"></i></div>
        <em class="radar-bar-value">${item.value} 条 · ${total ? Math.round((item.value / total) * 100) : 0}%</em>
      </div>`;
    })
    .join("");
  return `<section class="radar-chart"><h2>${esc(title)}</h2>${rows || "<p>暂无数据</p>"}</section>`;
}

function renderVBar(title, data) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const cols = data
    .map((item, index) => {
      const summary = chartSummary(item, total);
      return `<div class="radar-vbar" tabindex="0" data-tip="${esc(summary)}">
        <strong>${item.value}</strong>
        <div class="radar-vbar-track" aria-hidden="true"><i style="height:${(item.value / max) * 100}%;background:${CHART_COLORS[index % CHART_COLORS.length]}"></i></div>
        <span>${esc(item.label)}</span>
      </div>`;
    })
    .join("");
  return `<section class="radar-chart"><h2>${esc(title)}</h2><div class="radar-vbars">${cols || "<p>暂无数据</p>"}</div></section>`;
}

function renderDonut(title, data) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 64;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data
    .map((item, index) => {
      const length = (item.value / total) * circumference;
      const summary = chartSummary(item, total);
      const node = `<circle cx="90" cy="90" r="${radius}" fill="none" stroke="${CHART_COLORS[index % CHART_COLORS.length]}" stroke-width="${stroke}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"><title>${esc(summary)}</title></circle>`;
      offset += length;
      return node;
    })
    .join("");
  const legend = data
    .map((item, index) => {
      const summary = chartSummary(item, total);
      return `<li tabindex="0" data-tip="${esc(summary)}"><i style="background:${CHART_COLORS[index % CHART_COLORS.length]}"></i><span>${esc(item.label)}</span><em>${item.value} · ${Math.round((item.value / total) * 100)}%</em></li>`;
    })
    .join("");
  return `<section class="radar-chart"><h2>${esc(title)}</h2>
    <div class="radar-donut">
      <svg viewBox="0 0 180 180" role="img" aria-label="${esc(title)}">
        <circle cx="90" cy="90" r="${radius}" fill="none" stroke="var(--color-muted)" stroke-width="${stroke}"></circle>
        ${segments}
        <text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700">${data.reduce((sum, item) => sum + item.value, 0)}</text>
        <text x="90" y="106" text-anchor="middle" font-size="12">合计</text>
      </svg>
      <ul class="radar-donut-legend">${legend}</ul>
    </div>
  </section>`;
}

function renderChart(title, data) {
  if (state.chartStyle === "vbar") return renderVBar(title, data);
  if (state.chartStyle === "donut") return renderDonut(title, data);
  return renderHBar(title, data);
}

function renderViz(channel) {
  const data = state.vizSub === "supply" ? supplyChartData(channel) : scoreChartData(channel);
  const title = state.vizSub === "supply" ? "赛道供给量" : "评分分布";
  return `<div class="radar-subtabs" role="group" aria-label="可视化子视图">
      ${chips(
        [
          ["distribution", "分布结构"],
          ["supply", "赛道供给"],
        ],
        "viz",
        state.vizSub
      )}
    </div>
    <div class="radar-subtabs" role="group" aria-label="图表样式">
      ${chips(
        [
          ["hbar", "横向条形"],
          ["vbar", "柱状图"],
          ["donut", "环形图"],
        ],
        "chart",
        state.chartStyle
      )}
    </div>
    ${renderChart(title, data)}
    <p class="radar-note">每条都写了数量和占比。键盘聚焦或点击图条，可看到区间说明。评分分布包含未开分样本。</p>`;
}

function renderMeta() {
  const channel = currentChannel();
  if (state.mainTab === "daily") {
    const report = dailyReport();
    meta.textContent = report
      ? `每日上线 ${report.from} 至 ${report.to} · ${report.total} 款 · 快照 ${formatDate(state.launches?.fetchedAt)}`
      : "每日上线";
    return;
  }
  const filtered = channel ? filteredEntries(channel).length : 0;
  const extra = state.query.trim() || state.boardFilter !== "all" ? ` · 当前 ${filtered} 条` : "";
  meta.textContent = channel
    ? `${channel.label} · ${formatDate(state.snapshot.fetchedAt)} · ${channel.boards.length} 个榜 / ${channel.entries.length} 条${extra}`
    : "正在读取快照";
}

function renderChrome() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const on = button.getAttribute("data-tab") === state.mainTab;
    button.setAttribute("aria-selected", on ? "true" : "false");
  });
  const isDaily = state.mainTab === "daily";
  channelsNav.hidden = isDaily;
  channelDesc.hidden = isDaily;
  dailyControls.hidden = !isDaily;
  const dailyNote = document.getElementById("radar-daily-note");
  if (dailyNote) dailyNote.hidden = !isDaily;
  const channel = currentChannel();
  if (channel) {
    channelDesc.textContent = channel.error ? `${channel.description} 本渠道拉取失败：${channel.error}` : channel.description;
    channelsNav.querySelectorAll("[data-channel]").forEach((button) => {
      button.setAttribute("aria-pressed", button.getAttribute("data-channel") === channel.id ? "true" : "false");
    });
  }
  const fromInput = document.getElementById("radar-from");
  const toInput = document.getElementById("radar-to");
  if (fromInput && document.activeElement !== fromInput) fromInput.value = state.dailyFrom;
  if (toInput && document.activeElement !== toInput) toInput.value = state.dailyTo;
}

function render() {
  renderChrome();
  renderMeta();
  const channel = currentChannel();
  if (state.loadError) {
    status.hidden = false;
    status.textContent = state.loadError;
    view.innerHTML = "";
    return;
  }
  if (state.snapshot?.error && state.mainTab !== "daily") {
    status.hidden = false;
    status.textContent = `部分渠道异常：${state.snapshot.error}`;
  } else {
    status.hidden = true;
  }
  if (!channel && state.mainTab !== "daily") {
    view.innerHTML = `<p class="radar-message">快照里没有渠道数据。</p>`;
    return;
  }
  if (state.mainTab === "daily") view.innerHTML = renderDaily();
  else if (state.mainTab === "insight") view.innerHTML = renderInsight(channel);
  else if (state.mainTab === "analysis") view.innerHTML = renderAnalysis(channel);
  else if (state.mainTab === "viz") view.innerHTML = renderViz(channel);
  else view.innerHTML = renderList(channel);
}

function paintChannels() {
  channelsNav.innerHTML = channels()
    .map(
      (item) =>
        `<button type="button" class="radar-chip" data-channel="${esc(item.id)}" aria-pressed="${item.id === state.channelId ? "true" : "false"}">${esc(item.label)}${item.error ? " · 异常" : ""}</button>`
    )
    .join("");
}

function showTip(text, x, y) {
  tip.hidden = false;
  tip.textContent = text;
  const pad = 12;
  const rect = tip.getBoundingClientRect();
  const left = Math.min(x + pad, window.innerWidth - rect.width - 8);
  const top = Math.min(y + pad, window.innerHeight - rect.height - 8);
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function hideTip() {
  tip.hidden = true;
}

async function loadData(reload) {
  status.hidden = false;
  status.textContent = "正在加载榜单快照…";
  const cache = reload ? "reload" : "no-cache";
  try {
    const [snapshotRes, launchesRes] = await Promise.all([
      fetch(`./data/radar-snapshot.json?t=${Date.now()}`, { cache }),
      fetch(`./data/radar-launches.json?t=${Date.now()}`, { cache }),
    ]);
    if (!snapshotRes.ok || !launchesRes.ok) throw new Error("快照文件缺失");
    state.snapshot = await snapshotRes.json();
    state.launches = await launchesRes.json();
    state.loadError = "";
    if (!channels().some((item) => item.id === state.channelId)) state.channelId = channels()[0]?.id || "maker";
    paintChannels();
  } catch (error) {
    state.loadError = `榜单快照加载失败：${error instanceof Error ? error.message : String(error)}。可先在仓库运行 node scripts/fetch-radar.mjs。`;
  }
  render();
}

document.getElementById("radar-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  state.mainTab = button.getAttribute("data-tab");
  hideTip();
  render();
});

channelsNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-channel]");
  if (!button) return;
  state.channelId = button.getAttribute("data-channel");
  state.boardFilter = "heat";
  render();
});

view.addEventListener("click", (event) => {
  const button = event.target.closest("[data-board],[data-sort],[data-analysis],[data-viz],[data-chart],[data-expand]");
  if (!button) return;
  if (button.hasAttribute("data-board")) state.boardFilter = button.getAttribute("data-board");
  if (button.hasAttribute("data-sort")) state.listSort = button.getAttribute("data-sort");
  if (button.hasAttribute("data-analysis")) state.analysisSub = button.getAttribute("data-analysis");
  if (button.hasAttribute("data-viz")) state.vizSub = button.getAttribute("data-viz");
  if (button.hasAttribute("data-chart")) state.chartStyle = button.getAttribute("data-chart");
  if (button.hasAttribute("data-expand")) state.dailyExpanded = true;
  render();
});

document.getElementById("radar-query").addEventListener("input", (event) => {
  state.query = event.target.value;
  if (state.query.trim() && state.mainTab !== "daily" && state.mainTab !== "list") state.mainTab = "list";
  render();
});

document.getElementById("radar-from").addEventListener("change", (event) => {
  state.dailyFrom = event.target.value || state.dailyFrom;
  render();
});

document.getElementById("radar-to").addEventListener("change", (event) => {
  state.dailyTo = event.target.value || state.dailyTo;
  render();
});

document.getElementById("radar-ranges").addEventListener("click", (event) => {
  const button = event.target.closest("[data-range]");
  if (!button) return;
  const range = defaultDailyRange(Number(button.getAttribute("data-range")));
  state.dailyFrom = range.from;
  state.dailyTo = range.to;
  state.dailyExpanded = false;
  render();
});

document.getElementById("radar-reload").addEventListener("click", () => {
  void loadData(true);
});

view.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    img.hidden = true;
    const fallback = img.nextElementSibling;
    if (fallback instanceof HTMLElement) fallback.hidden = false;
  },
  true
);

view.addEventListener("mouseover", (event) => {
  const host = event.target.closest("[data-tip]");
  if (!host) return;
  showTip(host.getAttribute("data-tip"), event.clientX, event.clientY);
});

view.addEventListener("mousemove", (event) => {
  const host = event.target.closest("[data-tip]");
  if (!host || tip.hidden) return;
  showTip(host.getAttribute("data-tip"), event.clientX, event.clientY);
});

view.addEventListener("mouseout", (event) => {
  const host = event.target.closest("[data-tip]");
  if (!host) return;
  hideTip();
});

view.addEventListener("focusin", (event) => {
  const host = event.target.closest("[data-tip]");
  if (!host) return;
  const rect = host.getBoundingClientRect();
  showTip(host.getAttribute("data-tip"), rect.left, rect.bottom);
});

view.addEventListener("focusout", () => hideTip());

void loadData(false);
