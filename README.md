# TapMakerWork 官网

创建于 2026-09-21

TapMakerWork（TapTap Maker 第三方桌面 IDE）的产品官网静态站，用于 [Gitee Pages](https://gitee.com/AndroidSUP/tap-makerwork-site) 托管。

## 内容来源

文案与功能说明来自主仓 README / 文档：

- 主仓：[gitee.com/AndroidSUP/tap-maker-work](https://gitee.com/AndroidSUP/tap-maker-work)
- 镜像：[github.com/AndroidSix/TapMakerWork](https://github.com/AndroidSix/TapMakerWork)

## 结构

```text
index.html          # 单页官网
css/styles.css      # 样式（对齐 design-system 紫/粉开发者气质）
assets/             # 赞助收款码等静态资源
```

## 本地预览

直接用浏览器打开 `index.html`，或：

```bash
python3 -m http.server 8080
```

## 启用 Gitee Pages

1. 仓库 → 服务 → **Gitee Pages**
2. 分支选默认分支，目录选根目录 `/`
3. 启动后访问 `https://androidsup.gitee.io/tap-makerwork-site`
4. 之后每次推送若页面未更新，到 Pages 后台再点一次启动/更新

## 视觉说明

- Token 对齐主仓 `design-system/tapmakerwork`（主紫 `#7C3AED`、强调粉 `#EC4899`）
- Hero 右侧为 CSS 绘制的 Runtime 活编示意（无外链截图）
- 字体使用系统栈优先，避免国内环境访问 Google Fonts 失败
