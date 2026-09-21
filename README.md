# TapMakerWork 官网

创建于 2026-09-21

TapMakerWork（TapTap Maker 第三方桌面 IDE）产品官网静态站。

## 托管

**Gitee 个人仓当前无 Pages 服务入口**（仓库「服务」菜单中不存在 Gitee Pages），因此：

| 用途 | 仓库 |
|------|------|
| 站点源码 · 主 | [gitee.com/AndroidSUP/tap-makerwork-site](https://gitee.com/AndroidSUP/tap-makerwork-site) |
| 站点发布 · GitHub Pages | [github.com/AndroidSix/tapmakerwork-site](https://github.com/AndroidSix/tapmakerwork-site) |

预期访问地址：

```text
https://androidsix.github.io/tapmakerwork-site/
```

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

## 启用 GitHub Pages

1. 在 GitHub 创建公开仓库 `AndroidSix/tapmakerwork-site`（空仓即可）
2. 本目录增加远程并推送：

```bash
cd /Users/six.l/Documents/gitlab/tap-makerwork-site
git remote add github https://github.com/AndroidSix/tapmakerwork-site.git
git push -u github main
```

3. 仓库 → **Settings → Pages** → Source 选 **GitHub Actions**
4. 推送后查看 Actions 是否跑完 `Deploy GitHub Pages`
5. 访问 `https://androidsix.github.io/tapmakerwork-site/`

若你已 `gh auth login`，也可以让代理直接建仓、推送并开启 Pages。

## 同步建议

Gitee 与 GitHub 都作为官网源码仓维护；日常改完推两边：

```bash
git push origin main      # Gitee
git push github main      # GitHub Pages
```

## 视觉说明

- Token 对齐主仓 `design-system/tapmakerwork`（主紫 `#7C3AED`、强调粉 `#EC4899`）
- Hero 右侧为 CSS 绘制的 Runtime 活编示意（无外链截图）
- 字体使用系统栈优先，避免国内环境访问 Google Fonts 失败
