# P.E.R · Bryce Briss — IP Platform V3

本项目沿用第六轮网站结构、品牌视觉与静态卡片导航，在独立副本中增强了 Supabase 配置校验、未登录状态处理、后台错误状态、评论管理和移动端布局。它仍是静态前端加待配置的 Supabase 接入层；在数据库与授权测试通过前，不应视为已上线的动态平台。

## 本轮安全与验证状态

- 上传 ZIP 原件与此前第六轮基准均未覆盖；升级工作在独立目录进行。
- `supabase-config.js` 默认不含项目 URL 或 key。浏览器启动时只允许使用 HTTPS Project URL（仅本机 `localhost` 可使用 HTTP），并拒绝检测到的 `service_role`／Secret key。
- 当前未连接任何 Supabase 项目，也未执行任何 SQL。`supabase-schema.v3.sql` 是全新、一次性测试项目的安装草案，不是既有数据库迁移。
- 本地语法、HTML、链接与浏览器模拟测试结果见 `V3-UPGRADE-AUDIT.md`。真实账号、RLS、GRANT、数据库 CRUD、存储权限与跨设备持久化仍待授权测试。

## 本地启动

推荐使用 HTTP 本地服务器，不要把 `file://` 打开方式当成认证或数据库联调环境。需要 Python 3，在项目根目录执行：

```bash
python3 -m http.server 8000
```

然后访问 `http://127.0.0.1:8000/`。Windows 可使用 `py -m http.server 8000`。本地静态预览不依赖构建步骤；Bootstrap、Supabase JS 与字体从 CDN 加载，因此完整样式和交互预览需要可访问相应 CDN。

## 配置 Supabase（可选）

只有在你拥有项目且准备好单独的测试数据库时才配置。打开 Supabase Dashboard 项目设置中的 API／Data API 页面，复制**真实 Project URL**（通常形如 `https://<project-ref>.supabase.co`）和公开的 `anon`／publishable key，填入 `supabase-config.js`：

```js
window.BRYCE_SUPABASE_CONFIG = {
  url: "https://<project-ref>.supabase.co",
  anonKey: "<public-anon-or-publishable-key>"
};
```

不能用 Dashboard 显示名称代替 Project URL。若地址格式、网络或 key 不正确，前端只可报告客户端设置状态；这不代表数据库已连接、策略正确或数据已保存。**绝不可**把 `service_role`、`sb_secret_...`、数据库密码、JWT 私钥或其他 Secret 放入浏览器文件、截图或公开仓库。若需要分享代码，保留空白配置并通过不提交的部署变量／私有部署流程管理配置。

启用 Supabase 之前，先检查目标项目是否为空，并独立复核 V3 schema、RLS、grants、触发器与备份／恢复方案。不要在旧库或生产库直接执行 `supabase-schema.v3.sql`，也不要把旧版 `supabase-schema.sql` 或 `.v2.sql` 当作 V3 安装脚本。本仓库不自动执行 SQL；数据库更改必须另行获得授权并由负责人在隔离测试项目操作。

只有数据库 schema 已建立、RLS 和权限矩阵通过测试、认证 Redirect URL 正确、且管理员身份通过受信任流程授权后，作品／章节／评论等在线功能才可能工作。角色与世界观 CRUD、Supabase Storage 上传、系列编辑／删除目前没有完整实现。

## 页面与重要文件

- `index.html`：首页。
- `works.html`、`platform.js`：静态示例作品与已发布作品前端读取。
- `characters.html`、`entry.html`：静态角色／世界观与示例详情；动态档案 CRUD 尚未实现。
- `admin.html`、`admin.js`：作品、系列创建、章节和评论历史管理界面；依赖兼容的 V3 数据库及管理员 RLS。
- `community.html`、`community.js`：读者登录、作品评论和收藏界面；依赖已配置 Supabase。
- `read.html`、`read.js`：已发布作品和章节阅读界面。
- `supabase-config.js`：仅客户端公开配置，不得存放服务端秘密。
- `supabase-schema.v3.sql`：全新隔离测试项目的 schema 草案；未在本次任务执行。
- `V3-UPGRADE-AUDIT.md`：修改清单、测试结果、严重度与未验证事项。

## 已知限制

当前不提供角色／世界观管理、系列完整 CRUD、Supabase Storage 上传、版本历史、离线队列或服务端 API。评论历史和草稿访问的实际权限由 Supabase RLS 决定，本地界面无法替代权限验证。富文本编辑器仍使用 `document.execCommand()`，需进一步跨浏览器检查。部署前需在目标桌面与移动浏览器完成回归，并按 `SUPABASE-SETUP.md` 的矩阵完成授权测试。
