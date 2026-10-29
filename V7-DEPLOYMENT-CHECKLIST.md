# V7部署前检查表

- [ ] 从ZIP解压到新目录，保留V3原版目录/归档。
- [ ] 用 `python3 -m http.server 8000` 在项目根目录运行；不要使用`file://`。
- [ ] 只填写目标项目公开publishable/anon key；确认不是secret/service_role。
- [ ] 审阅 `V7-EXTERNAL-STATE-2026-10-28.md` 与 `V7-MIGRATION-REVIEW.md`，再次确认目标Project ref。
- [ ] 备份/确认恢复点；单独批准后再运行 `supabase-schema.v7.sql`。
- [ ] 在Auth URL Configuration将实际本地/部署Redirect URL加入允许列表；配置可达SMTP。
- [ ] 使用用户控制的测试邮箱注册读者账户，验证邮箱，再由项目所有者在受信任流程中授予admin；不要在前端授予。
- [ ] 以reader/anon/admin三种角色验收RLS、内容读写、图片公开/私有访问、归档与刷新持久化。
- [ ] 检查浏览器Console/Network、桌面/手机布局和错误/空状态后再部署。
- [ ] 记录迁移SQL、备份恢复点、测试结果及撤回决定。

详细操作和已知限制见[`README.md`](README.md)和[`V7-UPGRADE-AUDIT.md`](V7-UPGRADE-AUDIT.md)。
