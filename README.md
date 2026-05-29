# 學生成績管理系統

一個功能完整的多課程學生分組與成績管理工具，支援多個課程同時管理。使用 Next.js + Tailwind CSS + PostgreSQL (Neon) 建立，可部署至 Vercel。

## 功能特色

### 🔐 認證與權限管理
- **雙角色系統**：老師和學生兩種角色
- **學生名單由校務系統匯入（已停用自助註冊）**：學生不再自行註冊/選課，老師從 portalx 同步名單後，學生即可直接以學號登入。`/api/auth/register` 與自助加入課程已停用。
- **學生登入**：輸入學號即可登入（密碼 = 學號，有意簡化設計）；查無名單者提示「請聯絡授課老師」
- **舊學生相容**：已在 Student 表中的舊學生首次登入會自動建立 Account，無縫過渡
- **老師登入**：帳號 `admin` / 密碼 `peopleone`
- **路由保護**：未登入自動導向登入頁，學生無法訪問管理功能
- **JWT 認證**：使用 jose 庫，HttpOnly Cookie，有效期 7 天
- **API 保護**：所有寫入操作（POST/PUT/DELETE）需老師權限，學生分組 API 除外

### 📚 多課程管理
- **課程 CRUD**：老師可在首頁新增、編輯、刪除課程
- **課程選擇**：首頁可選擇不同課程進入管理
- **課程分離**：學生、分組、成績項目都按課程分離
- **A/B 分班控制**：每門課程可獨立設定是否啟用 A/B 分班（`hasClassDivision`），未啟用的課程會隱藏班級相關欄位
- **刪除保護**：刪除課程前顯示影響範圍（學生/分組/成績數量），需二次確認
- **擴展性**：可輕鬆新增更多課程

### 🎓 學生管理（老師專用）
- 新增、編輯、刪除學生資料
- 支援學號、姓名、Email、班級、課程資訊
- **AB班級分類**：支援A班/B班分類管理
- **班級篩選器**：可依班級快速篩選學生
- **課程關聯**：每位學生都屬於特定課程
- 學號唯一性驗證

### 👥 分組管理（老師）
- 建立多個學生分組（按課程分離）
- **選人分組**：新增分組時直接選擇學生，無需分組名稱和描述
- **快速搜尋**：支援姓名或學號搜尋，快速找到目標學生
- **唯一性限制**：每位學生在同一課程內只能加入一個組別
- **職位分配**：為分組成員分配職位（導演、模型、後製、動畫、企劃、美術）
- **組長指派**：可指定任意成員為組長，第一個選擇的學生預設為組長
- **視覺化顯示**：組長以黃色背景標示，各成員職位以標籤顯示
- **自動命名**：系統自動生成分組名稱，格式：第X組（自動遞增編號）
- **課程關聯**：每個分組都屬於特定課程

### 📄 期中報告 PDF 上傳與全螢幕展示
- **組長上傳**：在「我的分組」頁面，組長可為自己的組上傳期中報告 PDF（最大 100MB）
- **一組一份**：每組只保留最新版本，重新上傳會自動覆蓋並刪除舊檔
- **組員唯讀瀏覽**：同課程學生都能在「我的分組」頁面點「📖 瀏覽（全螢幕）」開啟 PDF
- **老師全螢幕展示**：老師在「分組管理」頁面可對每組一鍵進入 `📺 全螢幕展示`（適合上台報告時投影）
- **刪除**：組長或老師皆可刪除該組報告，Blob 與資料庫同步清除
- **儲存**：PDF 存在 Vercel Blob（public access），URL 寫入 `Group.reportUrl`
- **權限檢查**：上傳/刪除由 `StudentGroup.isLeader` 判定；老師不受限
- **PDF 檢視器**：使用瀏覽器原生 PDF viewer（iframe + `#toolbar=1&view=FitH`）+ Fullscreen API，不打包 react-pdf

### 🙋 學生自助分組（學生專用）
- **課程由名單決定**：學生所屬課程由老師從校務系統匯入名單決定（已停用自助加入課程）
- **我的分組頁面**：登入後查看所有已加入課程的分組狀態
- **建立新分組**：自動成為組長（isLeader），自動命名
- **加入現有分組**：從可用分組列表中選擇加入
- **離開分組**：組長離開時自動指派新組長，最後一人離開則刪除分組
- **組長管理**：
  - 編輯成員職位
  - 轉移組長身份給其他成員

### 📊 成績項目管理（老師專用）
- 建立多種評分項目（期中考、期末考、作業等）
- 設定各項目權重比例
- 自定義滿分標準
- **課程關聯**：每個成績項目都屬於特定課程
- **刪除功能**：可刪除不需要的成績項目（會同時刪除相關成績記錄）
- **詳細檢視**：點擊查看詳情可查看：
  - 成績項目基本資訊（權重、滿分、創建時間）
  - 統計資訊（已登記人數、平均分數、最高分、最低分）
  - 成績分布圖表（A/B/C/D/F等第分布）
  - 完整的學生成績列表（含學號、姓名、班級、分數、等第、百分比）
- **📥 Excel 成績導出**：
  - 支援自訂範本格式導出
  - 上傳你的 Excel 範本檔案（必須包含「學號」欄位）
  - 系統自動識別學號欄位並填入對應成績
  - 如範本無成績欄位，系統自動添加
  - 保持原始範本不變，下載全新檔案
  - 支援 .xls 和 .xlsx 格式
  - 顯示導出統計資訊（成功填入數量、未找到的學號等）
- **📋 複製填分腳本（校務系統 portalx 用）**：
  - 適用學校校務系統不支援 Excel 匯入、只能靠 DevTools Console 手動貼分數的情境
  - 一鍵把 `{ 學號: 分數 }` 對應內嵌進腳本複製到剪貼簿
  - **按學號比對欄位**（非按位置順序），portalx 排序/分頁不同也不會錯位
  - 找不到對應學號的列**自動跳過**，不會誤填非本班學生；不在本班名單的學生永遠不會被填
  - 可勾選「未登記成績也填 0 分」（預設不勾，避免覆蓋校務系統上既有分數）
  - 在校務系統成績登錄頁按 F12 → Console 貼上 → Enter 即填入；執行後 alert 顯示防呆統計（已填幾筆、哪些學號找不到欄位）
  - 腳本最上方的 `CONFIG` 可調整 selector 與學號正則以適配實際頁面結構
  - 腳本產生邏輯集中於 `src/lib/portalSync.ts`（與「校務同步」頁共用）

### ✍️ 成績登記（老師專用）
- **成績項目選擇**：從下拉選單選擇要登記的項目，每次專注登記一個項目
- **雙模式成績登記**：支援個人模式和分組模式
- **個人模式**：
  - 簡潔的三欄表格：學號/姓名、該項目成績、總成績
  - 點擊「點擊登記」按鈕輸入分數
  - 即時驗證分數範圍
  - 顯示每位學生的總成績（所有項目加權平均）
- **分組模式**：
  - 顯示每個分組的成員名單
  - 以分組為單位批次給成績
  - 一次輸入，整組成員獲得相同成績
  - **🔍 學號查組**：輸入學號快速找到對應組別，匹配的學號會以黃色高亮顯示
  - **智能過濾**：已評分完成的組別會自動從列表中隱藏，避免重複評分
  - **✏️ 成績修改**：勾選「顯示已評分組別」可查看並修改已評過的成績（適合補交作業調整分數）
  - **💬 組別評語**：
    - 每組成績按鈕下方有「💬 撰寫評語 / 💬 已寫評語」按鈕
    - 點擊開啟評語 Modal,老師可為該組在當前成績項目撰寫文字評語
    - Modal 內支援 `Cmd/Ctrl + Enter` 快速儲存、ESC 關閉
    - 已寫評語的按鈕變琥珀色,hover 可看預覽
    - 評語留空送出即視為**刪除**(保持資料乾淨,不存空字串)
    - 獨立表 `group_comments`,unique `(groupId, gradeItemId)`,組別或成績項目刪除時自動 cascade
  - **🎲 抽籤報告順序（老虎機動畫）**：
    - 點擊工具列「🎲 抽籤報告順序」按鈕，開啟全螢幕抽籤視窗
    - 所有分組卡片以老虎機動畫同時滾動約 3 秒（遞迴 setTimeout + 二次方緩動）
    - 揭曉時每張卡片依序（stagger 100ms）出現圓形編號徽章
    - **抽完後下方組別列表自動依抽籤順序重排**，每組左側顯示紫色圓形順序徽章（1、2、3...）
    - 老師可依順序從上往下給分，完成一組後該組自動隱藏，下一組上升到最上方
    - 可點「清除順序」還原原始順序，或點「再抽一次」重抽
    - 支援 ESC 鍵或背景點擊關閉（滾動中不中斷）
    - **純前端功能**：抽籤結果不寫入資料庫，刷新頁面即消失
  - **⏱️ 計時（報告限時）**：
    - 點擊工具列「⏱️ 計時」按鈕（位於抽籤按鈕左側），右下角彈出浮動計時視窗
    - **不擋畫面**：浮動視窗不阻擋頁面，老師可一邊計時、一邊操作下方組別與評分
    - 時間長度可自由設定（分/秒輸入，並提供 1/3/5/10 分快速預設），非固定
    - 支援暫停 / 繼續 / 重設；倒數以結束時間戳記反推，避免長時間漂移
    - **時間到自動發出鬧鈴**：以 Web Audio API 即時合成鬧鈴聲（約 4 聲後自動停止），同時畫面閃紅顯示「時間到」
    - **純前端功能**：不寫入資料庫
  - 所有組別評分完成後會顯示友善提示
  - 適合團隊作業、專題報告等情境
  - 大幅提升成績登記效率

### 🔄 校務系統同步（老師專用，`/portal-sync`）

把本系統與學校校務系統（portalx，`portalx.yzu.edu.tw/PortalSocialVB`，ASP.NET WebForms、只能網頁逐格手動輸入）橋接。提供**全自動上傳**與**手動備援**兩條路。

#### 🤖 自動上傳成績（GitHub Actions worker）

在 `/portal-sync` 選成績項目 → 按按鈕 → 觸發 GitHub Actions 臨時 runner，用 Playwright 自動登入 portalx、逐格填分、截圖回報，**跑完即焚**（一學期用 <10 次，免費額度綽綽有餘）。

- **乾跑(dry-run)優先**：預設「只填不送出」，回傳截圖供老師核對無誤後，再切「正式送出」。把寫正式成績這種不可逆操作變可逆。
- **學號比對填值**：重用 `src/lib/portalSync.ts` 的演算法，找不到對應學號的列自動跳過，不誤填非本班。
- **架構**：`POST /api/portal-sync/dispatch`（requireAdmin，組 scoreMap、建任務、呼叫 GitHub `repository_dispatch`）→ `.github/workflows/portal-upload.yml` → `worker/portalUpload.mjs`（Playwright）→ 截圖上傳 Vercel Blob → `POST /api/portal-sync/job-status`（共用密鑰驗證）回報 → UI 輪詢 `GET /api/portal-sync/jobs` 顯示狀態。
- **任務紀錄**：`PortalUploadJob` 表（`portal_upload_jobs`）。

**一次性設定**（採用此功能前）：
1. **Vercel 環境變數**：`GITHUB_DISPATCH_TOKEN`（fine-grained PAT，限本 repo、Actions read/write）、`GITHUB_REPO`（`Eric920418/student-grades-system`）、`WORKER_CALLBACK_SECRET`（自產長亂數）。
2. **GitHub Secrets**（repo → Settings → Secrets and variables → Actions）：`PORTAL_USERNAME`、`PORTAL_PASSWORD`、`WORKER_CALLBACK_SECRET`（與 Vercel 同值）、`APP_CALLBACK_URL`（`https://你的網域/api/portal-sync/job-status`）、`BLOB_READ_WRITE_TOKEN`。
3. **portal selector**：`worker/portalConfig.mjs` 內為合理猜測，需依 portalx 實際登入頁/成績頁 HTML 調整（或用 `PORTAL_*` Secret 覆蓋）。

> ⚠️ 自動操作 portalx 應確認符合學校系統使用規範；寫入正式成績前務必先乾跑 + 用少數學生確認。若 portal 日後改加驗證碼導致自動登入失效，可改用下方手動備援。

#### 🧑‍🎓 從 portal 自動同步學生名單（GitHub Actions worker）

在 `/portal-sync` 為課程填妥 portal 對應（課號 cosid / 學年 y / 學期 s）→ 按「同步名單」→ worker 登入 portalx、抓 `ClassMate.aspx` 名單頁（A/B 班直接以網址 `cosclass` 參數各別抓取）→ 回寫系統。

- **只新增、不覆蓋**：自動建立缺少的學生；既有資料一律不動，差異列標示待老師檢視（守住「不可覆蓋」）。
- **同時建立登入帳號**：匯入時 `account.upsert`，學生可直接以學號登入（取代自助註冊）。
- **停修自動跳過**（姓名含「(停修)」）。
- **架構**：`POST /api/portal-sync/dispatch`（`mode:'roster'`）→ worker `gotoRoster`/`scrapeRoster`（`worker/portalConfig.mjs`）→ `POST /api/portal-sync/roster`（worker-secret 驗證）→ 任務記於 `PortalUploadJob(kind='roster')`。
- **課程對應**：存於 `Course.portalCosId/portalYear/portalSemester`，由 `POST /api/portal-sync/course-config` 設定。
- 名單頁結構：`#Std_info` 表，欄位 [2]學號 [3]姓名 [6]E-Mail；班別取自抓取的 `cosclass`。測試夾具 `public/mock-classmate.html`。

#### 手動備援（client 端腳本注入）

腳本跑在老師「**已經登入**」的 portalx 分頁裡操作 DOM，不存帳密、不自動登入。因同源政策改用「剪貼簿 + 貼回」橋接。

- **⬆️ 上傳成績**：在「成績項目」各項目頁複製填分腳本，貼到 portalx 成績登錄頁 Console 執行（見上方說明，按學號比對）。
- **⬇️ 匯入學生名單/資料（系級、Email）**：
  - 在 `/portal-sync` 複製「撈取名單腳本」→ 貼到 portalx 名單頁 Console → 抓取結果**自動複製成 JSON 到剪貼簿**
  - 回到本系統貼上 JSON → **解析預覽（不寫入）**：分成「將新增 / 完全相同(略過) / 有差異(衝突) / 無效列」
  - **不覆蓋既有資料**：衝突列預設不動，需老師**逐列勾選**才以 portal 值覆蓋；後端 `commit` 在交易內二次確認，只更新勾選欄位
  - 可調整 selector（`columnMap`）以適配 portalx 實際 HTML，設定存 `localStorage`
- **API**：`POST /api/portal-sync/students/preview`（只讀比對）、`POST /api/portal-sync/students/commit`（依老師決定寫入），皆 `requireAdmin`
- **測試夾具**：`public/mock-portal.html` 模擬 portalx 成績登錄頁（亂序、含表頭、混入非本班學號），用於驗證填分腳本對位正確性

### 🏆 總成績計算
- **自動化權重計算**：總成績 = Σ(各項目分數/滿分 × 100 × 權重) ÷ Σ權重
- 即時更新總分顯示
- 成績等第顏色標示

## 技術架構

- **前端框架**：Next.js 14 (App Router)
- **樣式框架**：Tailwind CSS
- **資料庫**：PostgreSQL (Neon) + Prisma ORM
- **認證**：jose (JWT) + HttpOnly Cookie + Middleware 路由保護
- **開發工具**：TypeScript + ESLint
- **包管理**：pnpm
- **部署平台**：Vercel

## 快速開始

### 安裝依賴
```bash
pnpm install
```

### 環境變數設置
複製 `.env.example` 為 `.env` 並填入資料庫連接字串和 JWT 密鑰：
```bash
cp .env.example .env
```

編輯 `.env` 文件：
```
# 連線池 URL（Vercel 部署時走 Neon pooler，加上 pgbouncer=true 和 connection_limit=5）
DATABASE_URL="postgresql://username:password@host/database?sslmode=require&pgbouncer=true&connection_limit=5"
# 直連 URL（用於 Prisma migrate/push，不走連線池）
DIRECT_URL="postgresql://username:password@host/database?sslmode=require"
JWT_SECRET="your-secret-key-here"
# Vercel Blob token（期中報告 PDF 上傳用）
# 到 Vercel Dashboard → Storage → Create Blob 取得
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxx"
```

> **Neon 用戶注意**：`DATABASE_URL` 使用 pooler endpoint（通常含 `-pooler` 後綴），`DIRECT_URL` 使用直連 endpoint。詳見 [Neon 文件](https://neon.tech/docs/guides/prisma)。

### Excel學生名單匯入
系統提供專用腳本匯入Excel格式的學生名單：

```bash
# 匯入互動投影A班學生（從元智大學修課名單）
node scripts/import-interactive-a.js
```

**匯入功能特色：**
- **智能解析**：自動識別Excel中的學號、姓名欄位
- **標題行過濾**：自動跳過標題行，避免資料污染
- **重複檢測**：檢查學號是否已存在，避免重複匯入
- **課程關聯**：自動關聯到對應課程，若課程不存在會自動創建
- **詳細報告**：顯示匯入成功、跳過、失敗的詳細統計

### 初始化資料庫
```bash
pnpm prisma generate
pnpm prisma db push
```

### 啟動開發伺服器
```bash
pnpm dev
```

系統將運行在 http://localhost:3000

### 建構生產版本
```bash
pnpm build
pnpm start
```

## 認證說明

### 登入方式
| 角色 | 帳號 | 密碼 | 登入後頁面 |
|------|------|------|-----------|
| 老師 | admin | peopleone | 首頁（全部功能） |
| 學生（已在名單） | 學號 | 與學號相同 | /my-groups（我的分組） |
| 學生（不在名單） | - | - | 無法登入，請老師從校務系統匯入名單 |

### 權限對照表
| 功能 | 老師 | 學生 |
|------|--------|------|
| 課程管理（CRUD） | ✅ | ❌ |
| 學生管理 | ✅ | ❌ |
| 分組管理（老師版） | ✅ | ❌ |
| 成績項目管理 | ✅ | ❌ |
| 成績登記 | ✅ | ❌ |
| 我的分組（自助分組） | ❌ | ✅ |
| 查看課程列表 | ✅ | ✅ |

### 安全性說明
- 學號 = 密碼是有意的簡化設計，適用於課堂場景
- JWT token 儲存在 HttpOnly Cookie 中，前端 JS 無法直接讀取
- Middleware 在路由層攔截未授權存取
- API 層有額外的 `requireAdmin` 雙重保障

## 資料庫結構

### 課程表 (courses)
- `id`: 唯一識別碼
- `name`: 課程名稱 (唯一)
- `code`: 課程代碼 (選填)
- `description`: 課程描述 (選填)
- `hasClassDivision`: 是否啟用 A/B 分班 (預設 false)

### 帳號表 (accounts)
- `id`: 唯一識別碼
- `studentId`: 學號 (全域唯一)
- `name`: 學生姓名
- `class`: 班級 (A班/B班，默認為A班)
- `createdAt`: 建立時間

### 學生表 (students)
- `id`: 唯一識別碼
- `name`: 學生姓名
- `studentId`: 學號 (同課程內唯一)
- `email`: Email 地址 (選填)
- `class`: 班級 (A班/B班，默認為A班)
- `courseId`: 所屬課程 ID (外鍵)

### 分組表 (groups)
- `id`: 唯一識別碼
- `name`: 分組名稱 (同一課程內唯一)
- `description`: 分組描述 (選填)
- `courseId`: 所屬課程 ID (外鍵)
- `reportUrl`: 期中報告 PDF 的 Vercel Blob URL (選填)
- `reportFileName`: 期中報告原始檔名 (選填)
- `reportUploadedAt`: 期中報告上傳時間 (選填)
- `reportUploadedById`: 期中報告上傳者學號 (選填)

### 學生分組關係表 (student_groups)
- `studentId`: 學生ID (外鍵)
- `groupId`: 分組ID (外鍵)
- `role`: 職位 (選填：導演/模型/後製/動畫/企劃/美術)
- `isLeader`: 是否為組長 (布林值，預設 false)

### 成績項目表 (grade_items)
- `id`: 唯一識別碼
- `name`: 項目名稱 (同一課程內唯一)
- `weight`: 權重 (0-1)
- `maxScore`: 滿分
- `courseId`: 所屬課程 ID (外鍵)

### 成績表 (grades)
- `studentId`: 學生ID (外鍵)
- `gradeItemId`: 成績項目ID (外鍵)
- `score`: 分數

### 組別評語表 (group_comments)
- `id`: 唯一識別碼
- `groupId`: 分組ID (外鍵)
- `gradeItemId`: 成績項目ID (外鍵)
- `comment`: 評語內容（文字）
- `createdAt` / `updatedAt`: 建立 / 更新時間
- 唯一約束：`(groupId, gradeItemId)` 一組一個成績項目只有一則評語
- 刪除策略：組別或成績項目刪除時自動 cascade

## 使用說明

### 1. 登入系統
- 老師：使用 admin / peopleone 登入
- 學生：輸入學號即可登入

### 2. 老師操作
1. 登入後進入首頁，選擇要管理的課程
2. 透過功能卡片進入各管理模組：
   - **學生管理**：新增、編輯、刪除學生
   - **分組管理**：建立分組、分配學生和職位
   - **成績項目**：建立評分項目和權重
   - **成績登記**：個人模式或分組模式登記成績

### 3. 學生操作
1. 首次使用：在登入頁點「點此註冊」，輸入學號、姓名、班級完成註冊
2. 已有帳號：直接用學號登入（舊學生首次登入會自動建立帳號）
3. 登入後進入「我的分組」頁面，頂部顯示可加入的課程
4. 點擊「加入」按鈕加入課程
5. 查看所有已加入課程的分組狀態
6. 未分組的課程可以：
   - **建立新分組**：自動成為組長
   - **加入現有分組**：從列表中選擇
4. 已分組：
   - 查看組名、成員、職位
   - 組長可編輯成員職位、轉移組長
   - 任何成員都可以離開分組

### 4. 總成績計算邏輯
- 每個項目分數會先正規化為百分比：`(實得分數 ÷ 滿分) × 100`
- 再根據權重計算：`總成績 = Σ(正規化分數 × 權重) ÷ Σ權重`
- 例如：期中考60/100 (權重30%)、期末考80/100 (權重70%) → 總成績 = (60×0.3 + 80×0.7) ÷ (0.3+0.7) = 74分

### 5. Excel 成績導出
1. 進入成績項目詳情頁面
2. 在「📊 導出成績到 Excel」區塊
3. 點擊「選擇 Excel 範本檔案」上傳你的範本
   - 範本必須包含「學號」欄位（支援多種命名：學號、StudentID、Student ID、ID 等）
   - 可以是學校提供的固定格式表格
   - 支援 .xls 和 .xlsx 格式
4. 選擇檔案後，點擊「🎯 開始導出成績」
5. 系統會自動：
   - 讀取範本檔案
   - 識別學號欄位位置
   - 查找成績欄位（如果沒有則自動添加新欄位）
   - 根據學號填入對應成績
   - 生成新檔案供下載
6. 查看導出結果統計
   - 顯示成功填入的學生數量
   - 列出範本中有但系統中找不到成績的學號

## 開發者資訊

### API 路由

#### 認證 API
- `POST /api/auth/login` - 登入（學生或老師）
- `POST /api/auth/register` - 已停用（回 403）；學生帳號改由名單匯入建立
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 取得當前用戶資訊

#### 學生自助分組 API
- `GET /api/student/groups` - 取得該學號所有分組資訊（含 reportUrl 等 4 個報告欄位）
- `POST /api/student/groups` - 分組操作
  - `action: 'join-course'` - 加入課程（建立 Student 記錄）
  - `action: 'create'` - 建立新分組
  - `action: 'join'` - 加入分組
  - `action: 'leave'` - 離開分組
  - `action: 'update-role'` - 更新成員職位（組長限定）
  - `action: 'set-leader'` - 轉移組長（組長限定）
- `POST /api/student/groups/report/upload-token` - 期中報告 PDF 上傳授權（Vercel Blob Client Upload token）
  - 僅組長可呼叫；回傳 `@vercel/blob/client` 所需的 token
  - 伺服器端限制：`application/pdf`、最大 100MB、pathname 必須以 `reports/{groupId}/` 開頭
  - 不依賴 `onUploadCompleted` webhook（本地 localhost 收不到），DB 寫入改由前端在 `upload()` 完成後呼叫下面的 POST 端點
- `POST /api/student/groups/report` - 上傳完成後寫入 blob 元資料到 DB
  - 僅組長可呼叫；驗證 blob URL 必須為 Vercel Blob 網域且路徑以 `/reports/{groupId}/` 開頭（防跨組覆蓋）
  - 自動刪除該組舊 blob、寫入 `Group.reportUrl / reportFileName / reportUploadedAt / reportUploadedById`
- `DELETE /api/student/groups/report` - 組長刪除自己組的期中報告 PDF
  - 同時刪除 Vercel Blob 與資料庫 4 個欄位

#### 老師 - 期中報告 API
- `DELETE /api/groups/[id]/report` - 老師刪除指定組的期中報告 PDF（admin only）
  - 同時刪除 Vercel Blob 與資料庫 4 個欄位

#### 老師 API（需老師權限）
- `GET/POST /api/courses` - 課程管理（GET 開放，POST 需老師）
- `GET/PUT/DELETE /api/courses/[id]` - 單一課程操作（PUT/DELETE 需老師）
- `GET/POST /api/students` - 學生管理
- `GET/PUT/DELETE /api/students/[id]` - 單一學生操作
- `GET/POST /api/groups` - 分組管理
- `GET/PUT/DELETE /api/groups/[id]` - 單一分組操作
- `POST /api/groups/[id]/students` - 學生分組分配
- `GET/POST /api/grade-items` - 成績項目管理
- `GET/DELETE /api/grade-items/[id]` - 單一成績項目操作
- `POST /api/grade-items/[id]/export` - Excel 成績導出
- `GET/POST /api/grades` - 成績登記
- `POST /api/grades/group` - 分組成績登記
- `GET /api/group-comments` - 查詢組別評語（可用 gradeItemId 或 courseId 過濾）
- `POST /api/group-comments` - 新增或更新組別評語（upsert by groupId+gradeItemId；comment 為空則刪除）

### 專案結構
```
src/
├── app/
│   ├── api/
│   │   ├── auth/         # 認證 API
│   │   ├── student/      # 學生自助 API
│   │   ├── courses/      # 課程 API
│   │   ├── students/     # 學生管理 API
│   │   ├── groups/       # 分組管理 API
│   │   ├── grade-items/  # 成績項目 API
│   │   └── grades/       # 成績 API
│   ├── login/            # 登入頁面
│   ├── my-groups/        # 學生分組頁面
│   ├── students/         # 學生管理頁面
│   ├── groups/           # 分組管理頁面
│   ├── grade-items/      # 成績項目頁面
│   └── grades/           # 成績登記頁面
├── components/
│   ├── AuthProvider.tsx       # 認證 Context
│   ├── Navbar.tsx             # 導航列
│   ├── PresentationDrawModal.tsx  # 報告順序抽籤動畫
│   ├── PresentationTimer.tsx      # 報告限時浮動計時器（Web Audio API 鬧鈴）
│   └── PdfFullscreenViewer.tsx    # PDF 全螢幕檢視器（iframe + Fullscreen API）
├── lib/
│   ├── auth.ts           # 認證工具（JWT 簽發/驗證）
│   └── prisma.ts         # Prisma 客戶端
└── middleware.ts          # 路由保護中間件
```

## 響應式設計

系統支援手機、平板、桌面等多種裝置：

- **Navbar**：手機版顯示 Hamburger 選單，路由切換自動收合
- **學生管理**：手機版以卡片列表顯示，桌面版以表格顯示
- **所有表格**：加入水平捲動支援，避免手機上內容溢出
- **Modal**：手機版自適應 padding，不超出螢幕
- **按鈕組**：支援換行（flex-wrap），避免擠壓
- **斷點策略**：`sm:` (640px)、`md:` (768px)、`lg:` (1024px)

## 部署說明

### 本地部署
1. 建構專案：`pnpm build`
2. 啟動服務：`pnpm start`

### Vercel 部署
1. 將專案推送至 GitHub
2. 在 Vercel 中導入專案
3. 設置環境變數：
   - `DATABASE_URL`（Neon pooler 連接字串，加上 `?pgbouncer=true&connection_limit=5`）
   - `DIRECT_URL`（Neon 直連字串，用於 Prisma migration）
   - `JWT_SECRET`（JWT 密鑰，任意長字串）
   - `BLOB_READ_WRITE_TOKEN`（Vercel Blob token，於 Vercel Dashboard → Storage 建立 Blob store 後自動注入）
4. 部署完成

### 注意事項
- 資料庫使用 Neon PostgreSQL 雲端服務
- 部署前請確保 `DATABASE_URL`、`DIRECT_URL` 和 `JWT_SECRET` 環境變數已正確設置
- `DATABASE_URL` 應使用 Neon 的 pooler endpoint，`DIRECT_URL` 使用直連 endpoint
- 生產環境已關閉 Prisma query log，僅記錄 error 級別日誌
- 關鍵 API（登入、註冊、分組操作）已加入併發保護，支援 70 人同時使用
- Neon 免費額度足夠小型專案使用

---

**🤖 此專案由 Claude Code 自動生成**

建立時間：2025-09-12
技術支援：[Claude Code Issues](https://github.com/anthropics/claude-code/issues)
