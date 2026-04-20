# 學生成績管理系統

一個功能完整的多課程學生分組與成績管理工具，支援多個課程同時管理。使用 Next.js + Tailwind CSS + PostgreSQL (Neon) 建立，可部署至 Vercel。

## 功能特色

### 🔐 認證與權限管理
- **雙角色系統**：老師和學生兩種角色
- **學生自行註冊**：首次使用的學生可在登入頁點「點此註冊」，輸入學號、姓名、班級即可註冊
- **學生登入**：輸入學號即可登入（密碼 = 學號，有意簡化設計）
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
- **加入課程**：註冊後在「我的分組」頁面查看可用課程列表，點擊「加入」即可加入課程
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
- **📋 複製 JS 腳本（舊系統用）**：
  - 適用學校舊系統不支援 Excel 匯入、只能靠 DevTools Console 手動貼分數的情境
  - 一鍵把分數清單包在 `scoresText` 模板字串中複製到剪貼簿
  - 分數按學號字串升序（`localeCompare` 自然排序）排列，與舊系統欄位 DOM 順序對齊
  - **缺考學生自動以 0 分填入**（保持位置對齊，避免 `.filter(Boolean)` 吃空行造成整排錯位）
  - 在舊系統成績登記頁按 F12 → Console 貼上 → Enter 即自動填入所有 `input[type='text'][id]`（id 為純數字）
  - 按位置對應而非按學號匹配，使用前請確認舊系統欄位順序與學號一致

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
  - 所有組別評分完成後會顯示友善提示
  - 適合團隊作業、專題報告等情境
  - 大幅提升成績登記效率

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
| 學生（已註冊） | 學號 | 與學號相同 | /my-groups（我的分組） |
| 學生（新生） | - | - | 在登入頁點「點此註冊」 |

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
- `POST /api/auth/register` - 學生註冊（學號+姓名+班級）
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
