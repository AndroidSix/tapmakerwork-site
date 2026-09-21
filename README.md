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
css/styles.css                  # 样式（对齐 design-system 紫/粉）
assets/                         # 赞助收款码等
.github/workflows/pages.yml     # GitHub Pages 自动部署
```

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
- Hero 右侧为 CSS 绘制的 Runtime 活编示意（无外链截图）
- 字体使用系统栈优先，避免国内环境访问 Google Fonts 失败
