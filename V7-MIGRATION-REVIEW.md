# V7 数据库迁移预审（执行前，不是批准书）

**当前状态：未执行，等待对该精确脚本另行明确批准。** 脚本附件为 [`supabase-schema.v7.sql`](supabase-schema.v7.sql)。目标项目为用户指定 `BryceBriss_IP_test`，ref `sedotxzzxuowbkrhzxbw`。Dashboard 标记 `main / PRODUCTION`；迁移前须再核对当前 Dashboard URL 和备份，不可仅凭显示名称。

## 已检查事实与剩余不确定项

只读 Dashboard/API 检查显示：`public` 无表/视图，Auth Users 为 0，Storage buckets 为 0；目标 API可达，但V3业务表尚不存在。一次catalog SELECT由于Dashboard SQL Editor返回空查询验证错误而未得结果，因此尚未由查询直接确认`auth.users`非内部触发器、`storage.objects`策略、`public`固定函数与其他ACL。

V7 SQL 的 preflight 在同一事务里检查十个目标表、V7固定函数、`auth.users`上任何非内部触发器、目标两个bucket、`storage.objects`上任何现有policy、Storage schema/table预期GRANT与RLS启用状态；不匹配会`RAISE EXCEPTION`并回滚，不执行`DROP`或`CREATE OR REPLACE`。这只是代码级失败关闭设计，不替代迁移执行时管理员对预检结果的检查。目标项目标为生产分支使该步骤尤为重要。

## 计划创建的对象

| 区域 | 对象 | 业务用途 |
|---|---|---|
| `public` | `profiles`, `series`, `works`, `work_chapters`, `comments`, `favorites` | 保留V3账号资料、作品/系列/章节、评论/收藏数据契约 |
| `public` | `site_content` | 当前页面多语言文本覆写；按 `(content_key, locale)` 唯一，draft/published/archived |
| `public` | `contact_channels` | 作者主动选择公开的官方联系渠道，与登录邮箱分离 |
| `public` | `ip_entries` | character/world/gallery/journal 动态档案，plain-text正文、locale、状态、封面 |
| `public` | `media_assets` | Storage对象元数据，不含密钥 |
| `public` functions/triggers | `handle_new_user`, `is_admin`, `touch_updated_at`, `guard_profile_role`, `guard_public_cover`, `guard_published_chapter_media`及表触发器 | 新注册账号默认reader，管理员RPC判权，更新时间、私有封面与发布章节签名URL保护 |
| `storage` | `bryce-briss-public-media`, `bryce-briss-private-media` | 公开已批准图片与管理员私有草稿图片隔离，均限10MiB与指定图像MIME |
| `pg_policies` | `bryce_v7_*`对象策略 | 发布数据公开只读、管理员写、读者只能操作自己的评论/收藏、私有bucket管理员可读 |
| indexes | works/chapters/comments/favorites/CMS/entries/media索引 | 常见发布态、关联与排序查询 |

## 权限矩阵（设计目标）

| 数据 | `anon`访客 | 已登录Reader | RPC确认的Admin |
|---|---|---|---|
| 已发布作品/系列/章节/条目/站点文案/联系渠道 | 只读已发布；作品还要求所属系列发布 | 同公开 + 自己的资料 | 全状态读写/归档；写入由RLS约束 |
| profiles | 仅可读公开可见评论作者的 `id,display_name` | 本人资料及可公开评论作者字段 | 可读评论历史关联的display_name，role通过RPC判断；列级GRANT仍不含email/role |
| comments | 仅可读公开作品上的visible评论 | 可在公开作品插入自己的评论；不可自选作者/状态 | 可读历史、仅更新审核状态 |
| favorites | 不可读/写 | 仅自己公开作品收藏 | 不可越过RLS查看他人收藏 |
| `bryce-briss-public-media` | 公开读取 | 公开读取；上传/更新/删除仍需admin | 可上传、更新、删除 |
| `bryce-briss-private-media` | 不可读取 | 不可读取 | 仅admin读写；前端15分钟signed preview用于后台预览 |

数据库函数/RLS才是最终边界；前端 `requireAdmin()` 只是用户体验和提前失败检查。管理员角色不会在该迁移中授予，signup触发器只创建reader。

## 风险与回滚

1. 此为**全新schema安装**而非V3已有数据转换；如果执行时发现业务对象/触发器/policy/bucket，脚本应停止，不得移除guard继续运行。
2. SQL一次安装10张表、多项RLS和8个Storage策略/两个桶。Storage GRANT/RLS采用平台前置检查，不由该脚本扩大；任何GRANT或策略逻辑错误会影响公开访问/管理员写入；上线前先在目标项目做备份并按矩阵验证。
3. 公开bucket对象从上传起即可能通过公开URL读取；后台默认私有，公开上传选项必须由作者明确批准。发布作品/条目时数据库trigger阻止私有封面。
4. SQL自身无管理员提升语句，无密钥、账户或Auth设置变更；邮箱Redirect/SMTP须独立人工配置，不属于该迁移。
5. 事务失败会回滚该次SQL；事务成功后，按 [`V7-ROLLBACK-PLAN.md`](V7-ROLLBACK-PLAN.md) 做代码回退或备份恢复，不提供自动DROP脚本。

## 审批边界

要继续执行，必须在下一步展示完整脚本且明确征求对**`BryceBriss_IP_test` 项目、该 `supabase-schema.v7.sql` 文件确切内容**的执行批准。当前这份文档只是风险审阅资料，不构成写操作许可。
