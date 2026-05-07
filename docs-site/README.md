# DOCX Template System 文档站

基于 [Nextra](https://nextra.site/) + MDX 构建的产品文档站。

## 本地运行

```bash
cd docs-site

# 安装依赖
npm install

# 启动开发服务器（端口 3060）
npm run dev
```

打开 http://localhost:3060 即可预览。

## 构建

```bash
npm run build
```

静态文件输出到 `out/` 目录。

## 部署

### Vercel

1. 在 Vercel 中导入仓库
2. 设置 Root Directory 为 `docs-site`
3. Framework Preset 选择 Next.js
4. 部署

### GitHub Pages

已配置 GitHub Actions workflow（`.github/workflows/deploy-docs.yml`），当 `docs-site/` 目录变更时自动构建并部署到 GitHub Pages。

配置步骤：

1. 在仓库 Settings → Pages 中，Source 选择 **GitHub Actions**
2. 推送 `docs-site/` 目录的变更即可触发部署

`next.config.mjs` 中已配置 `basePath: '/docx-template-system'`。本地开发时如需去掉路径前缀，可临时注释该行。

```js
basePath: '/docx-template-system',  // GitHub Pages 需要此配置
```

## 目录结构

```
docs-site/
├── pages/
│   ├── index.mdx              # 首页
│   ├── guide/                 # 使用指南
│   ├── deploy/                # 部署指南
│   ├── template-syntax/       # 模板语法
│   ├── developer/             # 开发者文档
│   ├── troubleshooting/       # 故障排查
│   └── changelog/             # 更新日志
├── theme.config.tsx           # 主题配置
├── next.config.mjs            # Next.js + Nextra 配置
├── package.json
└── tsconfig.json
```

## 新增文档

在对应目录下创建 `.mdx` 文件，并在同目录的 `_meta.json` 中添加导航项即可。

示例：新增一个使用指南页面

1. 创建 `pages/guide/new-feature.mdx`
2. 在 `pages/guide/_meta.ts` 中添加 `"new-feature": "新功能"`
