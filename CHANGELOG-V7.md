# Changelog — V7

日期：2026-10-28

## 版本继承与变更

V7由V3（第六轮交付版）复制后增量修改，未覆盖V3基准目录或原始ZIP。保留原品牌、Bootstrap深色视觉、导航及首页/作品/角色世界观/画廊/日志/社区/阅读/后台页面。V3旧README以`README-V3-ARCHIVE.md`保留。

新增共享Auth服务及邮件回调/密码恢复页面；后台增加三语文案、公开联系渠道、角色/世界观/画廊/日志条目管理；新增媒体文件验证、公开/私有Storage上传、元数据和管理员私有预览。公开动态目录只读取已发布记录，用户内容以安全DOM API渲染。保留原作品、系列、章节、评论、收藏和归档业务；系列编辑、作品/章节保存边界与图片上传入口得到增强。

独立审查后补强：管理员可读评论历史所需的profile行策略；数据库及前端阻止已发布作品/条目/章节泄露签名/带query图片链接；媒体删除流程分页扫描作品、条目、章节引用；公开桶上传增加逐次确认与“草稿仍立即公开”提示；Storage迁移增加GRANT/RLS失败关闭检查。

## 数据库与配置边界

新增`supabase-schema.v7.sql`、迁移审阅和回滚文档。SQL尚未执行；没有更改表、策略、Bucket、用户、角色或数据。`supabase-config.js`仅预填已核对的目标Project URL，publishable key留空；未写入任何key/secret。

目标Supabase项目当前无业务表、Auth用户或Storage bucket；SMTP未配置、Redirect allow-list为空，目标Dashboard标记`main / PRODUCTION`。真实登录、RLS、数据库写入和Storage功能不宣称已上线。

## 验收结果

- 16个JavaScript文件全部通过`node --check`。
- 17个HTML页面静态结构检查通过；未发现重复ID或缺失本地`src`/`href`引用。
- Chromium经本地HTTP逐页打开17页：0个pageerror、0个请求失败；1280px与390px视口均无横向溢出。
- 本地Supabase SDK mock的Chromium交互测试通过：错误密码拒绝、mock管理员登录、发布文案、创建角色条目、拒绝伪装PNG、私有图片mock上传、保存作品、刷新后mock会话/数据读回、公开页mock文案读回。此结果**仅验证前端交互与本地mock存储，不是实际Supabase持久化**。
- `pglast`解析SQL 121条语句通过；这是离线语法解析，没有执行SQL。
- 对目标Auth API使用`example.invalid`虚构账号发起一次无效密码探测，收到HTTP 400 `invalid_credentials`；只证明Auth端点可达，不证明任何账户登录成功。
- 真实业务REST只读检查显示目标表不存在，Storage桶为0；真实账号登录、CRUD持久化、RLS矩阵与文件上传尚未验证。
