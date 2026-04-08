# 故障排查

## `http://localhost:8060/` 打不开

先检查是否有进程监听：

```bash
lsof -iTCP:8060 -sTCP:LISTEN -n -P
```

如果没有输出：

```bash
cd "/home/z/test-hub/docx-template-system"
npm run dev
```

## `next dev` 启动后很快失效，日志出现 `ENOSPC`

这是 Linux 文件监听数量上限问题。

如果出现：

1. 检查是否绕过了 `npm run dev`，直接手敲了别的 `next dev`
2. 确认没有同时开很多重复的开发进程
3. 再考虑提升系统 `inotify` 限制

```bash
# 临时提升限制
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches
```

## `/login` 能开，但点击统一登录失败

先检查：

- `AUTHENTIK_ISSUER`
- `AUTHENTIK_CLIENT_ID`
- `AUTHENTIK_CLIENT_SECRET`
- authentik 后台 Redirect URI

正确回调地址应为：

```text
http://localhost:8060/api/auth/callback/authentik
```

## 登录成功后没有管理员权限

先确认 authentik 用户邮箱是否和本地用户邮箱一致。

当前本地角色认领规则：

- 优先按 `oidcSubject`
- 其次按邮箱认领已有本地用户

如果需要首次自动成为管理员：

- 把邮箱加入 `AUTHENTIK_ADMIN_EMAILS`
- 或者在本地“用户管理”中手动把该邮箱设为 `ADMIN`

## 退出后再次进入还是自动登录

先确认两件事：

1. 前端是否经过 `/api/auth/sso-logout-url`
2. authentik 后台是否启用了正确的退出失效流程

如果只清本地 Session，没有清 authentik SSO，会出现“退出后再次进入自动登录”。

## `redirect_uri mismatch`

这通常是 authentik 后台和本地代码配置不一致。

检查：

- authentik 应用 Redirect URI
- `.env.local` 里的 issuer 和站点地址
- 是否把 `localhost`、`127.0.0.1`、端口、路径写混了

## `invalid_client`

先检查：

- `AUTHENTIK_CLIENT_ID`
- `AUTHENTIK_CLIENT_SECRET`

最常见原因：

- 从错误的 Provider 复制了凭据
- 修改 `.env.local` 后没有重启开发服务

## 页面框体或下拉弹层变透明

先打开公开 smoke page：

```text
http://localhost:8060/login/ui-check
```

重点看四件事：

1. 外层卡片是不是白底
2. 卡片边框是不是可见
3. Select 下拉层是不是白底深字
4. Popover、DropdownMenu 是否会透出背景内容

如果这个页面也异常，优先检查：

- `src/app/tokens.css`
- `src/components/ui/select.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`

如果 smoke page 正常，但业务页异常，说明更可能是业务页局部样式覆盖，不是全局 token 问题。

## dashboard 首屏很慢

先区分两类慢：

### 首次编译慢

表现：

- 某些页面第一次打开会明显慢
- 第二次打开明显变快

这通常是开发态编译成本，不是运行时错误。

### 请求链路慢

表现：

- 每次都慢
- 日志里 `proxy.ts` 或 `application-code` 耗时一直高

建议先看 dev 日志，再判断是：

- 页面本身数据加载慢
- API 查询慢
- 认证链路重复请求

## 数据页接口慢

当前已经优化过两条高频接口：

- [`src/app/api/data-tables/[id]/records/route.ts`](/home/z/test-hub/docx-template-system/src/app/api/data-tables/[id]/records/route.ts)
- [`src/app/api/data-tables/[id]/views/route.ts`](/home/z/test-hub/docx-template-system/src/app/api/data-tables/[id]/views/route.ts)

它们现在直接从 JWT 取路由用户，不再走 `getServerSession()`。

如果后续还有类似热点，可以继续沿这个方向收敛其它高频 Route Handler。

## 选项模板上传后解析为空

先区分两类原因：

### 模板语法本身不在支持范围内

当前支持：

- `{{选项:key|single}}` + `□ 选项`
- `{{选项:key|single}}` 或 `{{选项:key|multiple}}` 后跟 Word `w:sym` 形式的内联勾选段落，例如 `单项：☑是 ☐否`

当前不支持：

- 完全没有显式类型控制行，只摆一排勾选框让系统猜单选还是多选
- 使用了别的字体符号，但不是当前识别的 `Wingdings 2`
- 复杂嵌套到表格、文本框、页眉页脚的混合场景

### 运行中的服务还是旧版本

如果你已经改了：

- [`src/lib/docx-parser.ts`](/home/z/test-hub/docx-template-system/src/lib/docx-parser.ts)
- [`python-service/main.py`](/home/z/test-hub/docx-template-system/python-service/main.py)

但上传或生成结果还是旧行为，先重启：

```bash
cd "/home/z/test-hub/docx-template-system"
npm run dev
```

```bash
cd "/home/z/test-hub/docx-template-system/python-service"
".venv/bin/python" "main.py"
```

典型现象：

- Next 服务没重启：上传解析仍按旧规则运行
- Python 服务没重启：普通占位符会替换成功，但单选 / 多选勾选结果不更新

## 真实 Word 模板里多选都被解析成同一个文本

这通常不是用户看到的内容有问题，而是 Word 在 XML 里把：

- `选项1`
- `选项2`

拆成了多个连续 run，例如：

- `选项`
- `1`

当前实现已经兼容这种拆分。如果还复现，优先检查运行中的 Next 服务是不是旧进程。
