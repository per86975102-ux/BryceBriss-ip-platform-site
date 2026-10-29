# Bryce Briss IP Platform V3 · V7 实施方案

## 基准与原则

V7 以 `/home/ubuntu/BryceBriss_IP_Platform_V3_work/bryce-briss-ip-website` 的完整代码为唯一主要基准，在 `/home/ubuntu/BryceBriss_IP_Platform_V7_work/bryce-briss-ip-website` 独立副本内演进。基准共有 44 个文件，起始副本校验值一致。保留现有品牌、页面视觉、导航、Bootstrap 架构、原创静态资源、作品/阅读/社区/评论/收藏和归档语义；只对审计确认需要的模块进行增量重构。

目标 Supabase 为用户指定的 `BryceBriss_IP_test`（Project ref `sedotxzzxuowbkrhzxbw`）。Dashboard 标为 `main / PRODUCTION`，因此迁移执行前还必须核对精确 SQL 并取得单独批准。前端配置模板不包含任何 API key；启动说明要求用户只配置适合浏览器的 publishable/anon key，严禁 Secret/service_role、数据库密码进入代码、ZIP、浏览器或日志。

## 已核验后端状态与限制

只读检查已确认：正确 Project URL 为 `https://sedotxzzxuowbkrhzxbw.supabase.co`；当前自动化连接器 URL host 不匹配目标项目。目标 publishable key 与连接器 key 相符，但不在文件/报告中记录。用正确 URL 与 publishable key的零行 REST 探测可达，V3 业务表均返回 `PGRST205`（未创建）；Dashboard Table Editor 无 public 表/视图；Auth Users 为零；Email provider 和邮箱确认开启，新用户注册允许；自定义 SMTP 未配置；Site URL 目前为 `http://localhost:3000` 且 Redirect URLs 为空；Storage 为零桶。

一次 Dashboard SQL Editor catalog SELECT 因编辑器空查询验证错误没有成功执行，未改变数据库。因此 `auth.users` 上的 trigger、同名 public functions、既有 Storage policies 与角色 ACL 尚未由 catalog 查询验证；V7 SQL 应先做显式冲突检查并 fail-closed。不得直接执行旧 `supabase-schema.v3.sql`：其固定名称 `DROP TRIGGER`、`DROP POLICY` 与 `CREATE OR REPLACE FUNCTION` 可能改写共享对象。

## 前端模块

- 保留 vanilla HTML/CSS 站点；保留 `script.js` 的三语字典，增加可控覆盖层，让管理员编辑现有页面文案并按 locale 从后端读取。用户输入按纯文本输出，避免任意 HTML。
- `supabase-config.js` 仅放 Project URL 与空白 publishable key 配置项；交付包不带任何真实 key。缺配置、SDK 缺失、网络失败、未登录、无权限、空数据必须分别呈现，不假装后端连接成功。
- `platform.js` 负责共享 Supabase 客户端与安全显示/URL工具。
- 新 `auth-service.js` 负责会话恢复、邮箱密码登录/登出、密码重置、认证事件以及数据库管理员 RPC；前端只控制体验，最终权限由 RLS 执行。
- 新 `content-service.js` 负责 public/admin 数据访问、发布过滤、作品/系列/章节、通用站点文案、公开联系方式和 IP 条目。
- 新 `media-service.js` 负责图片 MIME/大小限制、预览、Storage 上传与进度状态、对象路径解析、元数据关联和受权限保护的删除；上传成功须由 Storage 响应确认，不能把本地预览当成持久化。
- 后台沿用现有视觉，增量增加站点文字/三语翻译、联系渠道、作品/系列/章节和 IP 条目编辑/发布/归档界面；保存结果以数据库读回为准。
- 作品、角色/世界观、画廊、创作日志页面从已发布记录动态展示；未配置后端时可保留原样例，但清晰标为示例；后端已连接且为空时显示空状态，而不冒充数据库内容。

## 数据模型和安全边界（SQL 待展示/审批）

保留 V3 `profiles / works / series / work_chapters / comments / favorites` 数据契约，并在 V7 初装脚本中提供以下新增对象：

- `site_content`：按 `(content_key, locale)` 保存现有 i18n 字典覆盖；草稿/发布状态；管理员写、匿名只读发布项。
- `contact_channels`：公开联系邮箱、商务/社交链接，和管理员账户/个人隐私分离；公开读取只限已发布条目。
- `ip_entries`：角色、世界观、画廊作品、创作日志的标题/slug/摘要/受控正文/封面/locale/状态/顺序；公开只读发布项，管理员维护草稿与归档。
- `media_assets`：Storage bucket + object path、MIME/大小/alt text/发布与关联元数据。

采用公开与私有双 Storage bucket：私有草稿默认私有，公开bucket的对象上传后立即可公开读取（即使内容记录仍是草稿），UI要求明确确认这一点；公开读取资源需作者自愿选择并经内容发布流程。上传/替换/删除由管理员权限控制；文件默认唯一不可覆盖，限制JPEG/PNG/WebP/AVIF和10MiB，文件头与MIME/大小双重校验。删除前检查作品、IP条目及章节正文引用；归档或解除关联不自动销毁仍被引用对象。

V7 SQL 采用单独文件和事务，先检查表/函数/触发器/policy/bucket 冲突；不使用 `DROP`、`CREATE OR REPLACE`，不触碰 Supabase 托管 schema 结构，不删除旧数据、不改变现有用户角色。任何未知对象/不兼容对象均报错中止。管理员 role 仅可由用户在账户核对后经受信任 Dashboard 手动初始化；不预置账号/密码。

## 邮箱回调/部署前置

Dashboard 当前 Site URL 是 `http://localhost:3000`，但仓库建议 HTTP 本地端口为 8000，且 Redirect allow-list 为空。SMTP 未设置。代码提供明确的验证/重置状态和回调说明；未获批准前不修改 Dashboard URL、邮件模板或 SMTP。真实邮件送达、验证和重置只有在用户提供可收件测试账户并配置可达回调/SMTP后测试。

## 验证与交付状态纪律

测试分四栏记录：**代码已实现**、**本地运行已测试**、**真实后端/数据库已测试**、**尚需外部配置/人工验证**。先做本地 HTTP、语法、DOM/资源/链接、视口和无后端错误分支测试。用户尚未批准迁移前不做真实业务写入；执行迁移后才可开展真实 Auth/RLS/文字 CRUD/图片上传持久化验收。每项未运行测试标“未验证”并说明阻塞与下一步。

最终包含完整 V7 ZIP、版本升级说明、变更清单、独立审计/测试报告、启动/配置指南、V7 SQL、精确对象清单与风险、回滚说明。原 V3 目录与原始 ZIP 保留不动。
