# 增強版報表功能

- [x] 規劃增強版報表功能
- [x] 修改 download.ts - 增強月報表格式
  - [x] 完整出席表格 (日期橫向)
  - [x] 個人出席次數統計
  - [x] 組員狀況區塊
  - [x] 關懷名單區塊  
  - [x] 調整字級 (12-14pt)
- [x] 整合 AI 摘要功能
  - [x] 安裝 @google/generative-ai
  - [x] 建立 API Route (app/api/summarize/route.ts)
  - [x] 更新 Reports 介面 (加入摘要生成按鈕)
  - [x] 設定 環境變數 (GEMINI_API_KEY)
  - [x] 修正 AI SDK 404 錯誤 (改用 Native Fetch + Gemini 2.0 Flash Exp)
- [ ] 測試匯出功能

# 儀表板權限管理
- [x] 規劃權限系統
- [x] 實作權限設定檔 (`lib/permissions.ts`)
- [x] 更新儀表板 (`app/dashboard/page.tsx`) 加入權限檢查
- [x] 驗證不同帳號的顯示結果
