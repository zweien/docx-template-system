# 统一版本管理设计

## 目标

建立统一的版本发布流程：通过 `npm run release` 命令自动更新版本号、生成 CHANGELOG、创建 git tag，并在登录页和侧边栏始终显示当前版本。

## 版本注入

在 `next.config.ts` 中将 `package.json` 的 `version` 字段注入为构建时常量：

```ts
import pkg from './package.json';

export default defineConfig({
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
});
```

前端组件通过 `process.env.NEXT_PUBLIC_APP_VERSION` 读取。无需 API 调用，版本在构建时确定。

## UI 显示

### 登录页

在 `src/app/(auth)/login/page.tsx` 的 Card 组件底部添加版本号显示：

- 位于 CardFooter 区域
- 居中显示，样式：`text-muted-foreground text-xs`
- 格式：`v1.2.3`

### 侧边栏

在 `src/components/layout/sidebar.tsx` 的导航列表下方、侧边栏底部添加版本号：

- 展开状态：显示 `IDRL填表系统 v1.2.3`
- 折叠状态：只显示 `v1.2.3`
- 样式与侧边栏整体风格一致，使用 `text-muted-foreground text-xs`

## Release 工具链

使用 `standard-version`（devDependency）管理版本发布：

### 安装

```bash
npm install --save-dev standard-version
```

### npm scripts

```json
{
  "release": "standard-version",
  "release:first": "standard-version --first-release",
  "release:minor": "standard-version --release-as minor",
  "release:major": "standard-version --release-as major"
}
```

### 工作流程

```bash
# 1. 开发时使用 conventional commits
git commit -m "feat: add new feature"
git commit -m "fix: resolve login bug"

# 2. 准备发布 — 自动 bump 版本、生成 CHANGELOG、创建 commit 和 tag
npm run release           # patch: 1.0.0 → 1.0.1
npm run release:minor     # minor: 1.0.0 → 1.1.0
npm run release:major     # major: 1.0.0 → 2.0.0

# 3. 推送代码和 tag
git push --follow-tags
```

### `standard-version` 自动执行

1. 根据 conventional commit 类型（feat/fix/breaking）确定 bump 类型
2. 更新 `package.json` 的 `version` 字段
3. 生成/更新 `CHANGELOG.md`
4. 创建 git commit（包含 CHANGELOG 和 package.json 变更）
5. 创建 git tag（格式 `v1.2.3`）

## 涉及文件

| 文件 | 变更 |
|------|------|
| `package.json` | 添加 `standard-version` devDep 和 release scripts |
| `next.config.ts` | 注入 `NEXT_PUBLIC_APP_VERSION` 环境变量 |
| `src/app/(auth)/login/page.tsx` | 登录页底部添加版本显示 |
| `src/components/layout/sidebar.tsx` | 侧边栏底部添加版本显示 |
| `CHANGELOG.md` | 新建，由 `standard-version` 自动生成 |
| `.versionrc.json` | 可选，standard-version 配置 |

## 不做的事

- 不添加 CI/CD 自动发布流程（项目目前没有 CI/CD）
- 不做版本检查更新提示
- 不做 API 返回版本号（构建时注入即可）
