# Bryce Briss IP Platform — 靜態審查與 GitHub Pages 部署準備

## 本輪範圍
- 審查基準：`BryceBriss_IP_Platform_V7_2026-10-28.zip`。
- 本輪只做本地檔案檢查與部署配置準備；沒有連接或修改 GitHub 倉庫，沒有部署網站，沒有執行 SQL，也沒有寫入 Supabase。
- 此報告不能證明 ZIP 與 GitHub 倉庫最新內容一致。

## 已確認
- 專案為原生 HTML/CSS/JavaScript 靜態站點；ZIP 中未見 `package.json`、Vite/webpack 等建置設定。
- `supabase-config.js` 中的 `anonKey` 為空；沒有在此檔中發現已配置的瀏覽器 key。
- `.gitignore` 已排除 `.env`、`.env.*`、私鑰檔與 service-role 相關命名；仍須在提交前人工檢查檔案及 Git 歷史，不要把任何 Secret 上傳。
- `supabase-schema.v7.sql` 明確是空白 schema 的受保護初裝腳本，不是可直接套用到既有資料庫的通用升級腳本。不要在未核對目標專案、備份、完整 SQL 和單獨批准前執行。
- V7 文件已把 mock/本地測試與真實 Supabase 驗收區分；真實登入、郵件、RLS、CRUD 持久化及 Storage 仍須實際驗收。

## 本次新增的部署準備
新增 `.github/workflows/pages.yml`：
- `main` 分支 push 或手動觸發時，將倉庫根目錄作為靜態網站部署到 GitHub Pages。
- 使用 GitHub Pages Actions；沒有額外建置步驟，因 ZIP 沒有前端 bundler/build 設定。
- 這只是配置準備。要真正部署，仍須把檔案上傳到倉庫、確認預設分支為 `main`（若不同則修改 workflow），並在 GitHub Repository Settings → Pages 中將 Build and deployment source 設為 GitHub Actions。
- 若倉庫尚未有程式碼，工作流程不會因為只在本地新增此檔案而運行。

## 發佈前需完成
1. 檢查倉庫及提交內容，確認沒有 Supabase Secret、資料庫密碼、私鑰、個人資料或不打算公開的原創材料。
2. 確認 `main` 分支名稱，並將網站檔案與 `.github/workflows/pages.yml` 一起提交。
3. 在 GitHub Pages 設定選擇 GitHub Actions；觀察 Actions 執行結果與部署 URL。
4. 檢查手機和桌面端頁面、頁內導航、直接打開子頁、404 頁、瀏覽器 Console/Network。
5. GitHub Pages 只提供靜態前端；Supabase Auth/資料庫/Storage 是另一個系統，需單獨完成設定及安全驗收。
6. ZIP 中部分文件為歷史階段報告，內容可能過時；以實際程式碼和最新測試結果為準，後續應統一更新文件。

## 優先級
- **P0**：確認提交內容沒有任何 Secret；不在未批准情況下執行 V7 SQL；維持 Supabase RLS/Storage 為實際安全邊界。
- **P1**：上傳程式碼與本 workflow；確認分支名稱、Pages 設定與部署成功；完成真實 Supabase 設定和測試。
- **P2**：清理歷史階段文件與相互矛盾的說明；明確標示示例作品/角色，之後再導入正式作品與角色資料。
