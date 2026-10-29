# Bryce Briss IP Platform V7

V7 是此前 V3（第六轮基准）的增量升级，不是重新生成的网站。原有品牌、Bootstrap 深色视觉、首页、作品、角色/世界观、画廊、日志、社区、阅读与后台页面都保留；新增真实 Supabase Auth 入口、后台三语文案/联系渠道/IP条目管理、双 Storage 桶媒体上传与公开目录读取。V3 原 README 保存在 [`README-V3-ARCHIVE.md`](README-V3-ARCHIVE.md)。

## 当前真实后端状态（只读核验）

本交付以用户指定的 `BryceBriss_IP_test` 项目为目标，Project ref 为 `sedotxzzxuowbkrhzxbw`，Project URL 已在 `supabase-config.js` 预填；公开 publishable/anon key 保持空白，ZIP 不含真实 key。Dashboard/API 的只读盘点见 [`V7-EXTERNAL-STATE-2026-10-28.md`](V7-EXTERNAL-STATE-2026-10-28.md)。检查显示该项目目前没有业务表、Auth 用户或 Storage bucket；Email provider 与邮箱确认开启，但 SMTP 未配置，Redirect URL 列表为空，Site URL 仍为 `http://localhost:3000`。Dashboard 标记 `main / PRODUCTION`，所以部署数据库前置变更必须先核对准确 SQL 并另行批准。

**没有执行 SQL、DDL/DML、账户创建/升级、Bucket/策略创建或其他数据库写操作。** 客户端“初始化成功”只表示 URL 与公开 key 能创建 SDK client，不代表数据库、RLS、邮件或存储已可用。

## 本地启动

需要 Python 3。在项目根目录运行：

```bash
python3 -m http.server 8000
```

然后打开 `http://127.0.0.1:8000/`。请勿用 `file://` 测试认证、Storage 或跨页资源。在线样式和 Supabase SDK 来自 CDN，完整预览需要网络。

## 配置浏览器端 Supabase

在 `supabase-config.js` 中只填写目标项目的**公开** publishable/anon key：

```js
window.BRYCE_SUPABASE_CONFIG = {
  url: 'https://sedotxzzxuowbkrhzxbw.supabase.co',
  anonKey: '粘贴该目标项目的公开publishable/anon key'
};
```

URL 是 Supabase Project URL（不是 Dashboard 项目显示名称）。严禁粘贴 `service_role`、`sb_secret_...`、数据库密码或其他服务端 Secret。代码会拒绝识别为 Secret 的 key。

配置客户端不等于完成后端。SQL 尚待用户审批执行；在迁移后、Auth URL/邮件设置完成之前，后台保存和上传会明确失败，不会退化成“前端假保存”。

## Auth、邮箱和管理员设置

1. 在 Supabase Auth URL Configuration 中将本地测试地址加入 Site URL/Redirect allow-list，例如 `http://127.0.0.1:8000/**`；部署时另外设置真实 HTTPS 域名。代码回调页是 `auth-callback.html` 和 `auth-recovery.html`。
2. Email provider 已启用并要求邮箱确认；当前项目没有用户且自定义 SMTP 未启用。正式测试前配置可收件的 SMTP，确认验证/恢复邮件实际送达。
3. 读者通过社区页注册后，新账号由数据库触发器创建为 `reader`。前端没有管理员密码、角色开关或管理员自注册入口。
4. 管理员身份只能在确认目标用户 UUID 后，通过受信任的 Supabase Dashboard SQL/管理流程手动授予；未提供也未执行账户提升语句。`is_admin()` RPC 与 RLS 是最终权限边界，单纯登录不等于管理员。

## 数据库变更门槛

[`supabase-schema.v7.sql`](supabase-schema.v7.sql) 是**面向当前已核验空 `public` schema 的受保护 V7 初装脚本**，不是通用的 V3 数据迁移。事务内先检查10个目标表、固定函数、`auth.users`应用触发器、两个V7桶、`storage.objects`现有policy，以及Storage schema/table权限和RLS状态；发现不匹配即停止，不尝试覆盖或自行扩大托管Storage GRANT。脚本创建V3兼容核心表、V7 CMS表、RLS/GRANT、认证触发器、索引和公开/私有媒体桶。

执行前请：

- 再确认 Dashboard URL 中的 Project ref 确为 `sedotxzzxuowbkrhzxbw`，并确认这是本次允许改变的目标环境；
- 对 SQL 全文、前置对象状态、权限差异和 [`V7-ROLLBACK-PLAN.md`](V7-ROLLBACK-PLAN.md) 作最终复核；
- 明确批准该精确迁移后，再由项目所有者/获批执行者运行。脚本不会由网站自动运行，也未由本任务执行。

不得在旧 V3 库直接运行该 fresh-schema 脚本；不得用 V3旧SQL覆盖本项目状态。迁移对象和风险详见 [`V7-MIGRATION-REVIEW.md`](V7-MIGRATION-REVIEW.md)。

## V7后台使用

后台沿用原页面，并新增：

- 按中文/English/Français 和页面分组编辑默认 i18n 文案，可保存草稿或发布；公开页面仅以纯文本覆写模板。
- 创建/编辑/归档角色、世界观、画廊与日志条目；公开页仅读取已发布记录。
- 管理独立公开联系渠道；不会读取或展示 Auth 用户邮箱。
- 作品封面与IP条目图片默认上传到私有桶；选择公开桶前须确认图片获准公开，因为对象上传后立即可读，即使内容仍为草稿。公开条目不能引用私有封面。章节插图上传到公开桶前也需逐次确认。
- 封面“解除关联”只清空数据库字段，不删除对象；替换时旧对象保留，避免意外删除仍在使用的资源。

媒体接受 JPEG/PNG/WebP/AVIF，最大 10 MiB；浏览器同时检查声明MIME与文件头，Storage bucket 也设置 MIME/大小限制。媒体上传和元数据写入需分别成功；元数据写入失败时前端尝试清理刚上传对象并报告清理结果。

## 验收与限制

请以 [`V7-UPGRADE-AUDIT.md`](V7-UPGRADE-AUDIT.md) 的实际结果为准；它区分纯本地、浏览器模拟、真实Supabase只读探测和未验证项。真实登录成功、邮箱投递/验证、管理员授权、迁移后 CRUD/刷新持久化、RLS 角色矩阵及真实 Storage 上传，必须在迁移获批、SMTP/redirect 配置完成且有可用测试账户后逐项验收。

项目没有服务端中转层。公开 key 本身不是秘密，但所有安全仍由 Supabase RLS、Storage policies、Auth 和部署的 HTTPS 配置承担。此版本不包含离线队列、版本回滚或审计日志；后台UI没有物理删除媒体按钮，媒体服务的受保护删除方法会先扫描作品、IP条目及章节正文引用。日常维护优先归档或解除关联；勿绕过引用检查直接删除Storage对象。
