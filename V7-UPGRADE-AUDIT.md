# Bryce Briss IP Platform V7 系统审计与升级报告

**审计日期：** 2026-10-28（+08）  
**唯一代码基准：** 用户提供的第六轮 V3 修订包工作副本  
**目标Supabase项目：** `BryceBriss_IP_test`，Project ref `sedotxzzxuowbkrhzxbw`  
**远端写入状态：** 未执行SQL/DDL/DML；未创建用户、提升角色、创建Bucket或修改远端权限/数据  
**结论：** V7代码升级与本地测试完成，可进入迁移审批和受控集成验收；目标后端当前无业务schema、Auth用户和Storage bucket，因此真实登录、CRUD持久化及图片上传尚未达到可上线验收条件。

## 范围、版本关系与审计方法

V7从V3完整文件副本增量升级，保留原品牌、暗色Bootstrap视觉、导航和首页、作品、角色/世界观、画廊、日志、社区、阅读与后台页面。没有覆盖原V3目录或原始ZIP；旧V3 README 另存为`README-V3-ARCHIVE.md`。新增Auth/邮件回调、管理端文案与IP条目CMS、动态公开目录、图片上传和迁移/回滚文档。

检查HTML/CSS/JS及页面引用、会话/权限/数据契约、SQL/RLS/Storage方案，并运行本地HTTP Chromium测试。独立复审意见逐条与当前副本重新核验；例如复审曾提示Auth新用户触发器可能缺少`SECURITY DEFINER`，但当前`supabase-schema.v7.sql`实际已有`SECURITY DEFINER`及空`search_path`，故不把该意见误报为当前故障。

## A. 已确认的错误或阻塞项

| 问题与状态 | 对应文件/路径 | 原因 | 复现/验证方式 | 修复或建议 |
|---|---|---|---|---|
| **Supabase连接器曾指向错误Project URL（已在V7配置模板纠正）** | `supabase-config.js`；`V7-EXTERNAL-STATE-2026-10-28.md` | 会话连接器内配置URL主机未匹配Dashboard中`BryceBriss_IP_test`的Project ref，也未匹配组织内另一个项目，错误地址会连接失败或误连其他环境。 | 对照连接器URL主机与Dashboard的API Project URL/Project ref；本轮另以正确目标URL发起Auth探测并获得Auth API响应。 | V7的`supabase-config.js`已预填目标项目URL；公开publishable/anon key留空，等待项目所有者填写。不得用`service_role`或secret key。 |
| **目标项目没有业务schema/账号/媒体桶（真实后端阻塞）** | `supabase-schema.v7.sql`、`platform.js`、`supabase-config.js` | Dashboard/API只读检查显示`public`没有业务表/视图，Auth Users为0，Storage buckets为0；预期业务表的REST探测返回关系不存在（PGRST205）。前端key留空时不会初始化Supabase客户端。 | 对目标API探测业务表（零行查询仍报关系不存在）、Dashboard Auth Users/Buckets查看当前为空；不写数据。 | V7准备了受保护初装脚本，但本轮没有执行。需审阅脚本、备份并对该精确脚本另行批准后再运行。 |
| **邮件/回调设置缺失，真实注册与恢复不能端到端验收** | Supabase Auth URL/SMTP；`auth-service.js`、`auth-callback.html`、`auth-recovery.html` | Email provider已启用且要求邮箱确认，但无Auth用户、自定义SMTP未启用、Redirect allow-list为空，Site URL仍为localhost:3000。 | Dashboard检查Auth Users、SMTP、URL Configuration；真实测试邮件送达被当前配置阻塞。 | 配置实际部署/本地HTTP Redirect URL及可收件SMTP后，使用所有者控制的测试邮箱验证确认和密码重置；本任务未改Dashboard设置。 |
| **历史`Auth session missing!`问题在当前代码未复现；真实空会话未能对目标项目完整验收** | `auth-service.js`、`admin.js`、`community.js` | V7以`getSession()`将无登录会话作为`null`处理，再单独调用Admin RPC；目标项目无用户且网页key留空，无法完成真实登录会话的全路径观察。 | 本地mock跑过匿名/错误密码/管理员登录；真实目标Auth API只用`example.invalid`虚构凭据登录，返回400 `invalid_credentials`，不是成功登录。 | 保持“会话读取”和“管理员授权”分离；迁移及测试账户就绪后再用真实浏览器验证会话恢复、退出、过期和RPC失败。 |

## B. 高风险项与部署前处置

| 风险 | 对应文件/路径 | 风险原因 | 复现/验证方式 | 建议修复/处置 |
|---|---|---|---|---|
| **目标Dashboard标记`main / PRODUCTION`；初装脚本不是通用V3升级** | `supabase-schema.v7.sql`、`V7-MIGRATION-REVIEW.md` | 该脚本会新建10张表、函数/触发器、RLS/GRANT、8条Storage策略和2个Bucket；即使业务schema空，仍会改变生产项目。 | 打开当前Dashboard核对project ref/分支；检查SQL全文和十表/触发器/Storage策略清单。SQL内有事务和冲突预检，但当前未在真实DB执行。 | 先备份/确认恢复点，再由项目所有者审阅完整SQL并单独批准；只有目标状态符合预检才继续。不得在已有V3业务schema上运行此fresh-schema脚本。 |
| **无管理员账户；注册用户不会自动成为管理员** | `supabase-schema.v7.sql`、`auth-service.js`、`admin.js` | 新用户触发器固定创建`reader`；前端登录成功不代表Admin。当前目标Auth用户为0。 | 创建一般读者后尝试后台操作；真实验证应确认RPC `is_admin()`为false且数据库写入被RLS拒绝。该真实矩阵尚未执行。 | 先使用所有者控制的测试用户验证reader权限；项目所有者另按受信任流程核对UUID并单独授予admin。不要新增前端提权入口，也不要在本次迁移中自动提升任何人。 |
| **公开Bucket上传后立即公开，不受草稿状态保护** | `media-service.js`、`admin-v7.js`、`admin.html`、`supabase-schema.v7.sql` | Supabase public bucket的对象上传即可能通过公开URL读取，作品/条目仍为draft也一样；章节插图也使用公开桶。 | 迁移后上传一张无版权风险测试图至public bucket，用匿名请求读取公开URL；确认即使条目状态draft也可访问。当前仅在mock流程验证，不访问真实Storage。 | 图片默认私有；公开上传和章节插图需逐次确认并说明立即公开。只对已授权公开图片操作；若需草稿图片绝不外露，应使用private bucket并仅在发布时改为公开路径/受控对象。 |
| **前端配置默认不连接真实后端** | `supabase-config.js`、`README.md` | key留空是避免凭据泄露的交付安全状态；不填公开key时Auth、读写、上传均不可用。 | 打开本地HTTP页面查看`data-platform-mode`/后台状态；确认key为空且不会创建client。 | 仅配置目标项目的公开publishable/anon key；不使用`service_role`、`sb_secret`、DB密码。配置成功也不代表schema/RLS/SMTP已完成。 |
| **媒体物理删除仍需谨慎** | `media-service.js`、`supabase-schema.v7.sql`、`admin.js` | 管理端媒体删除helper先扫描作品封面、IP条目封面及章节正文引用；绕过helper直接调用Storage API仍可能删除被引用图片。章节后台还保留带二次确认的物理删除按钮。 | 在mock中/迁移后先引用图片再触发受保护删除，应被阻止；不要通过Dashboard绕开扫描做生产测试。真实后端行为未测。 | 日常用归档/解除封面关联，不删除Storage对象。未来可将章节删除改为归档并增加审计日志；若确需物理删除，先验证全部引用和备份。 |
| **曾尝试Dashboard SQL Editor只读catalog查询但未成功提交** | `V7-MIGRATION-REVIEW.md`、`supabase-schema.v7.sql` | 编辑器返回空查询验证错误；不能据此声称已检查`auth.users`应用触发器、`storage.objects`既有策略/ACL或所有固定函数。 | SQL Editor操作记录显示SELECT没有成功运行；目标应用REST和Dashboard页面只读状态另行已检查。 | 迁移脚本执行前的preflight对Storage GRANT/RLS、已有policy、Auth trigger等失败关闭；执行者仍须检查运行结果。若预检失败，停止并调查，不能移除guard后重跑。 |

## C. 尚待实际运行/授权后验证的事项

| 未验证事项 | 文件/组件 | 目前为何未验证 | 后续复现/验收步骤 |
|---|---|---|---|
| 真实邮箱密码登录、退出、恢复/过期会话、邮箱确认与密码重置 | `auth-service.js`、`community.js`、`auth-callback.js`、`auth-recovery.js` | 目标无Auth用户；SMTP/Redirect未配置；本地浏览器Supabase key留空。 | 迁移后配置SMTP/Redirect，用测试账户完成注册确认、错误密码、登录/刷新/退出、恢复邮件和密码更新，并记录Network/Auth结果。 |
| 真实CMS/作品/系列/章节保存后刷新持久化 | `admin-v7.js`、`admin.js`、`content-service.js`、`supabase-schema.v7.sql` | 目标表不存在，已做的交互持久化测试使用本地mock。 | 使用测试Admin新增草稿，刷新/新会话读回；编辑并发布三语文案、角色/world条目、作品/系列/章节，再从公开页按发布状态读回。 |
| 匿名/reader/admin的实际RLS角色矩阵、评论及归档历史 | `supabase-schema.v7.sql`、`community.js`、`read.js`、`admin.js` | SQL未执行，且无reader/admin测试账户。 | 匿名读者仅读已发布内容；reader只能提交自己的评论/收藏；admin能读审核历史并仅更新审核状态；归档作品对公开用户隐藏、管理员保留历史。 |
| Storage公开/私有上传和真实权限 | `media-service.js`、`supabase-schema.v7.sql` | 当前Storage桶为0；未创建对象或策略。 | 迁移后分别上传private/public测试图片：匿名读取private应拒绝、管理员签名预览应成功、public应匿名可读；检查Metadata、MIME/大小拒绝与引用删除阻止。 |
| 异常网络、SMTP邮件投递、生产托管/HTTPS/CDN/CSP和真实手机设备 | 全站；`README.md` | 本轮在本地HTTP和浏览器mock验收；没有远端写入或生产部署环境。 | 迁移后离线/恢复网络，检查错误和重试；按部署域名配置redirect/CSP，实际设备复测。不要用`file://`作为上线验收。 |
| 部分Supabase内部对象目录 | `supabase-schema.v7.sql`的preflight | 一次Dashboard SQL Editor只读SELECT未执行，不能声称已经catalog级验证所有Auth触发器/Storage策略/ACL。 | 执行前由项目管理员只读查看或运行受审阅catalog查询；如脚本preflight报冲突，停止并检查。 |

## 已完成的可复现测试结果

- 对根目录16个JavaScript运行`node --check`：全部通过。
- 对17个HTML页面扫描结构、重复ID、本地`src`/`href`：没有重复ID或缺失引用。
- Chromium通过本地HTTP逐页加载17页：没有`pageerror`或请求失败；1280px桌面与390px手机视口无横向溢出。此项不代表后端成功。
- 浏览器Supabase SDK mock交互测试通过：错误密码拒绝、mock管理员登录、发布首页文案、创建角色条目、伪装PNG被文件头/MIME校验拒绝、合法PNG mock上传到私有桶、草稿作品关联、刷新后mock会话/CMS/作品读回、公开页显示mock发布文案。数据来自本地测试mock的localStorage，**不是Supabase持久化**。
- `pglast`离线解析`supabase-schema.v7.sql`共121条语句通过；SQL未运行。
- 目标Auth真实端点对`example.invalid`虚构账号返回HTTP 400 `invalid_credentials`；仅确认端点可达，无用户创建或成功登录。
- 目标业务REST只读探测显示业务表不存在；Storage bucket数为0。

## D. 优化建议与验收顺序

1. 先核对Dashboard当前Project ref和`main / PRODUCTION`分支，再阅读完整[`supabase-schema.v7.sql`](supabase-schema.v7.sql)、[`V7-MIGRATION-REVIEW.md`](V7-MIGRATION-REVIEW.md)和[`V7-ROLLBACK-PLAN.md`](V7-ROLLBACK-PLAN.md)，确认备份后另行审批。
2. 迁移成功后配置Auth的本地HTTP/部署HTTPS Redirect URL和可投递SMTP；创建所有者控制的测试reader，再单独批准admin角色。
3. 按reader/admin/anon矩阵实测RLS；发布带唯一标记的内容后刷新后台/公开页验证真实读回；检查草稿、发布、归档、网络失败和非法输入。
4. 用无版权风险图片分别测试private/public bucket、匿名访问边界、私有预览、metadata失败处理及引用删除保护。
5. 保留SQL执行日志、备份/恢复点、Console/Network结果和移动端截图；建议先在独立测试项目跑完全套验收，再决定生产部署。

## 启动与交付索引

本地预览在项目根目录运行`python3 -m http.server 8000`并访问`http://127.0.0.1:8000/`。主要说明见[`README.md`](README.md)和[`V7-DEPLOYMENT-CHECKLIST.md`](V7-DEPLOYMENT-CHECKLIST.md)；数据库审阅见[`V7-MIGRATION-REVIEW.md`](V7-MIGRATION-REVIEW.md)，回滚见[`V7-ROLLBACK-PLAN.md`](V7-ROLLBACK-PLAN.md)，改动摘要见[`CHANGELOG-V7.md`](CHANGELOG-V7.md)。完整项目和SQL在本报告同目录及对应交付ZIP中。
