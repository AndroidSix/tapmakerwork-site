# TapMakerWork 官网

创建于 2026-09-21

TapMakerWork（TapTap Maker 第三方桌面 IDE）产品官网静态站。

## 托管

**GitHub Pages**（Gitee 官网仓已删除，不再维护）

| 用途 | 地址 |
|------|------|
| 站点源码 + 发布 | [github.com/AndroidSix/tapmakerwork-site](https://github.com/AndroidSix/tapmakerwork-site) |
| 线上访问 | [androidsix.github.io/tapmakerwork-site](https://androidsix.github.io/tapmakerwork-site/) |
| 产品主仓（Gitee） | [gitee.com/AndroidSUP/tap-maker-work](https://gitee.com/AndroidSUP/tap-maker-work) |

官网源码只在本 GitHub 仓维护；产品本体、Issue、PR 仍以 Gitee 主仓为准。

## 内容来源

文案与功能说明来自主仓：

- 主仓：[gitee.com/AndroidSUP/tap-maker-work](https://gitee.com/AndroidSUP/tap-maker-work)
- 镜像：[github.com/AndroidSix/TapMakerWork](https://github.com/AndroidSix/TapMakerWork)

## 结构

```text
index.html                      # 单页官网
radar.html                      # 新游雷达网页版
css/styles.css                  # 样式（对齐 design-system 紫/粉）
css/radar.css                   # 雷达看板
js/radar-core.js                # 与桌面端对齐的计算
js/radar-app.js                 # 看板交互
data/                           # 榜单快照 + 安装包版本
data/release.json               # 最新安装包版本（CI 同步）
scripts/fetch-radar.mjs         # 拉取 TapTap / Steam 并写快照
scripts/sync-release.mjs        # 从 GitHub Releases 同步版本
assets/                         # 图标、赞助收款码、演示视频
assets/demo/                    # 核心演示 + 内置工具录屏
.github/workflows/pages.yml     # GitHub Pages 自动部署
.github/workflows/radar-data.yml
.github/workflows/sync-release.yml
```

## 安装包版本同步

创建于 2026-09-28

下载区版本与直链由 `data/release.json` 驱动，页面加载时自动套用。

本地手动同步：

```bash
node scripts/sync-release.mjs
```

Actions：`Sync latest release` 每 6 小时拉取 `AndroidSix/TapMakerWork` 的 latest release；有变化会自动提交并触发 Pages 部署。也可在 Actions 里手动跑，或从主仓发 `repository_dispatch`（`release-published`）即时同步。

## 新游雷达网页版

创建于 2026-09-28

页面：`radar.html`。榜单、每日上线、洞察、分析台和可视化与桌面端同一套计算。浏览器不能直连 TapTap / Steam，页面读取 `data/` 里的快照。

本地更新快照：

```bash
node scripts/fetch-radar.mjs
```

推到 `main` 后，Actions 里的 `Refresh radar snapshot` 大约每 6 小时拉一次并重新发布 Pages。

## 本地预览

浏览器直接打开 `index.html`，或：

```bash
python3 -m http.server 8080
```

## 发布

推送 `main` 后，Actions 会跑 `Deploy GitHub Pages`。

仓库 **Settings → Pages → Source** 需为 **GitHub Actions**。

```bash
git push origin main
```

## 视觉说明

- Token 对齐主仓 `design-system/tapmakerwork`（主紫 `#7C3AED`、强调粉 `#EC4899`）
- 主题：默认**跟随系统**，导航栏可手动切换「自动 / 浅色 / 深色」
- Hero 右侧为 CSS 绘制的 Runtime 活编示意（无外链截图）
- 字体使用系统栈优先，避免国内环境访问 Google Fonts 失败

## 文案口径

- 主仓 / Issue / PR：**GitHub** `AndroidSix/TapMakerWork`
- Gitee：国内镜像下载
- 当前安装包版本：**v0.1.4**（由 `data/release.json` 驱动；CI 从 GitHub Releases 自动同步）
- 含社区 QQ 群、内置工具介绍（图片压缩 / 新游雷达）与后续开发计划摘要
