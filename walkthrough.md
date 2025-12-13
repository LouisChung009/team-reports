# 增強版報表與 AI 整合功能導覽

我們已成功將應用程式恢復正常，並整合了 AI 智慧摘要增強報表功能。

## 主要更新

### 1. **AI 智慧月報表**
- **功能**: 自動整合組員當月的代禱事項與備註，生成簡潔、溫暖的近況摘要。
- **技術**: 整合 Google Gemini API (`gemini-pro`)。
- **介面**: 在報表中心新增了「使用 AI 智慧摘要 (Beta)」勾選框。
- **後端**: 新增 `/api/summarize` API 路由，負責處理 AI 提示詞工程與 API 通訊。

### 2. **增強版報表格式 (Word & Excel)**
- **Word 匯出**:
  - 完整的月度出席網格（日期橫向排列）。
  - 個人出席次數統計欄位。
  - **新區塊**: 「組員狀況」 (Member Status) - 整合每位組員的所有備註/代禱事項（或顯示 AI 摘要）。
  - **新區塊**: 「本月新朋友」 (New Visitors)。
  - 字體大小調整為 12pt+ 以提升閱讀性。
- **Excel 匯出**:
  - 結構與 Word 報表一致。
  - 分頁顯示：「出席記錄」、「組員狀況」、「本月新朋友」。

### 3. **語音輸入功能**
- 在點名頁面的備註欄位新增麥克風按鈕，方便語音輸入代禱事項。

---

## 驗證步驟

請在您的本機環境 (`http://localhost:3000`) 驗證以下流程：

### 1. 測試 AI 智慧摘要
1. 前往 **報表中心** (`/reports`)。
2. 選擇一個有出席資料的月份（確保該月有些會議記錄與備註）。
3. 勾選 **「使用 AI 智慧摘要 (Beta)」**。
4. 點擊 **「匯出 Word」**。
5. *觀察*: 按鈕應顯示「AI 生成中...」，隨後下載檔案。
6. 開啟 Word 檔檢查 **「組員狀況」** 區塊。您應該會看到通順的摘要，而非原始的片段紀錄。

### 2. 測試 Excel 匯出
1. 在同一頁面，點擊 **「匯出 Excel」**。
2. 開啟下載的 Excel 檔。
3. 驗證是否包含 3 個工作表（出席記錄、組員狀況、新朋友），且資料正確。

### 3. 語音輸入 (僅限 Chrome/Edge 瀏覽器)
1. 前往任一聚會的 **點名頁面**。
2. 點擊代禱事項輸入框旁的 **麥克風圖示**。
3. 對著麥克風說一句話。
4. *觀察*: 文字應會自動出現在輸入框中。

---

## 部署指南

### 自動部署 (推薦)

本專案已設定 **GitHub Actions** 自動部署。當程式碼推送到 `main` 分支時，會自動建置並部署到 Firebase Hosting。

**部署流程：**
1. 在本地完成開發與測試
2. 提交變更並推送到 GitHub：
   ```bash
   git add .
   git commit -m "your commit message"
   git push origin main
   ```
3. GitHub Actions 會自動執行建置與部署
4. 約 2-3 分鐘後，更新會出現在 `team-reports-15602.web.app`

### 跨平台開發說明

> [!NOTE]
> 本專案支援在 Windows 和 macOS 之間切換開發。
> `package-lock.json` 已加入 `.gitignore`，避免跨平台套件衝突。
> 每個平台會在 `npm install` 時產生各自的 lock 檔案。

**換機器開發時：**
```bash
cd /Volumes/資料區/報表/group-manager  # 或 Windows 對應路徑
npm install
npm run dev
```

### 環境變數設定

> [!IMPORTANT]
> **需要設定環境變數**
> 目前 `GEMINI_API_KEY` 為了方便測試暫時寫在程式碼中。
> 在正式環境中，請將金鑰設定在 GitHub Secrets：
> 1. 前往 GitHub Repo → Settings → Secrets and variables → Actions
> 2. 新增 `GEMINI_API_KEY` 環境變數
> 3. (選用) 移除 `app/api/summarize/route.ts` 第 5 行的硬編碼金鑰

---

## 儀表板權限設定指南

我們已針對您的需求實作了「設定檔驅動」的權限管理系統。

### 如何設定牧者權限

1. **開啟設定檔**
   請編輯專案中的 `lib/permissions.ts` 檔案。

2. **編輯使用者清單**
   找到 `USER_CONFIG` 物件，依照以下格式加入牧者的 Email 與權限：

   ```typescript
   const USER_CONFIG: Record<string, (Permission | "ALL")[]> = {
     // 給予特定牧者部分權限
     "pastor.john@example.com": [
       DASHBOARD_PERMISSIONS.VIEW_QUICK_STATS, // 僅觀看上方數據卡片
       DASHBOARD_PERMISSIONS.VIEW_CARE_LIST    // 僅觀看關懷名單
     ],
     
     // 給予另一位牧者報表權限
     "pastor.jane@example.com": [
       DASHBOARD_PERMISSIONS.VIEW_MONTHLY_REPORT
     ],
     
     // 給予全權限
     "admin@church.org": ["ALL"]
   };
   ```

3. **權限列表對照**
   - `VIEW_QUICK_STATS`: 頂部數據卡（成員數、聚會數等）
   - `VIEW_ATTENDANCE_CHART`: 出席人數趨勢圖
   - `VIEW_MONTHLY_REPORT`: 月報表匯出區塊
   - `VIEW_MEMBER_STATS`: 成員個別出席率圖表
   - `VIEW_CARE_LIST`: 牧養關懷名單

4. **生效方式**
   儲存檔案後，重新整理網頁即可生效。未列在清單中的使用者將套用 `DEFAULT_PERMISSIONS` (預設為全開放，您可以修改變數設為 `[]` 以關閉)。

---

## 檔案變更列表
- `app/reports/page.tsx`: 報表介面與邏輯更新。
- `lib/download.ts`: 增強版 Word/Excel 生成邏輯。
- `app/api/summarize/route.ts`: [新增] AI API 端點。
- `components/SpeechTextarea.tsx`: [新增] 語音輸入元件。
- `lib/permissions.ts`: [新增] 權限設定檔。
- `app/dashboard/page.tsx`: [修改] 整合權限檢查。
