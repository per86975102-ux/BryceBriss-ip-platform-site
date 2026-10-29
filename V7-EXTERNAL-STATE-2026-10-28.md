# V7 后端只读盘点记录

核对日期：2026-10-28。范围：用户授权的 Supabase Dashboard 与目标项目 publishable API；只读操作。未执行 SQL、未创建/修改 Auth 用户、未更改 Site URL/Redirect URL、未创建 Storage bucket、未写入或删除记录。

## 项目定位

- Dashboard 项目：`BryceBriss_IP_test`；Project ID：`sedotxzzxuowbkrhzxbw`；区域显示为 `ap-southeast-2`（Sydney）。Dashboard 分支标签显示 `main / PRODUCTION`，因此在获得 SQL 执行批准前应将任何部署写入视为高风险。
- 组织内另一个项目 ID 为 `mizraoyfnrnamdjccpya`。当前授权连接器的 `SUPABASE_URL` 主机与上述两个项目 ID 均不匹配，且该配置主机在当前环境无法 DNS 解析；公共 `supabase.com` DNS 可解析。项目 Dashboard 中读取到的 publishable key 与连接器 `SUPABASE_KEY` 相符。未读取、复制或使用任何 Secret/service_role key。
- 正确项目根 URL 由 Dashboard Project ID 推导为 `https://sedotxzzxuowbkrhzxbw.supabase.co`。该目标主机在本环境 DNS 可解析。使用此 URL 和匹配的 publishable key 发起零行 REST 探测，目标 API 可达；V3 所需的 `profiles`、`works`、`series`、`work_chapters`、`comments`、`favorites` 及建议新增的站点内容/联系方式/媒体表均未在 schema cache 中存在（响应 `PGRST205`）。Storage `list_buckets()` 返回 0 个桶。

## Dashboard 状态

- Table Editor（`public`）：显示 **No tables or views**。
- Authentication → Users：显示 **No users in your project**。
- Authentication → Sign In / Providers：Email provider 已启用；允许新用户注册；Confirm email 已启用；OAuth/电话等不在本轮范围。
- Authentication → Emails → SMTP Settings：**Enable custom SMTP 未启用**。因此自定义邮件服务尚未配置，验证邮件送达/密码重置邮件的正式可靠性仍不能宣称通过。
- Authentication → URL Configuration：Site URL 为 `http://localhost:3000`；Redirect URLs 列表为空。项目与本地 HTTP 默认端口 8000 不匹配；邮箱验证和恢复流程需要在批准后配置准确测试与部署回调地址。
- Storage → Buckets：无桶。未看到任何存储资源可读写。

## 原始来源（授权 Dashboard 页面）

- 项目列表：`https://supabase.com/dashboard/org/pjjiplgscaiwfbqoekxv`
- 目标项目 General：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/settings/general`
- Table Editor：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/editor`
- Auth Users：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/auth/users`
- Sign In / Providers：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/auth/providers`
- SMTP Settings：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/auth/smtp`
- Auth URL Configuration：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/auth/url-configuration`
- API Keys（仅查看公开 key 状态，未记录 key 值）：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/settings/api-keys`
- Storage：`https://supabase.com/dashboard/project/sedotxzzxuowbkrhzxbw/storage/files`

## 审计含义

当前项目不是已有 V3 数据库迁移场景，而是 public schema 尚未安装业务对象的空库场景；应准备版本化、带前置条件的 V7 初装/增量脚本。由于 Dashboard 标记 `PRODUCTION`，不能仅依项目名称推定其为安全沙箱。SQL 必须先展示内容、对象清单、权限影响和回滚步骤，再由项目所有者另行批准执行。


## 额外 catalog 检查（06:20 +08）

尝试通过目标项目 SQL Editor 运行一条只包含 `SELECT` 的 catalog 汇总语句（public 关系、`auth.users` 非内部触发器、固定名称 V3 函数、扩展、`storage.objects` 策略）。编辑器将文本显示在代码区，但点击 Run 后返回 `0 rows` 与 `Error: query: Too small: expected string to have >=1 characters`；因此查询没有提供有效 catalog 结果。未执行任何 DDL、DML、用户/权限/Storage 更改。Auth trigger、公共函数/ACL、Storage policies 仍是未验证项；独立 V7 SQL 将以冲突即停止的 preflight 处理，最终申请执行前需要人工 review。


## Auth API 连通性探测（06:41 +08）

对目标 Project URL 使用当前匹配的公开 publishable key，向 `sign_in_with_password` 发起一次保留域名 `example.invalid` 的虚构账号/密码请求。Auth API 返回 HTTP 400 `invalid_credentials`，说明目标 Auth 端点可达并拒绝无效凭据；该测试不是成功登录，不创建账号、不更改会话或数据库，也未暴露key/密码。Dashboard仍显示无Auth用户，因此真实账户登录/确认流程仍无法验收。
