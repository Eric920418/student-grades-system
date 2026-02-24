# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言與規範

- 用繁體中文回答
- 只使用 pnpm 管理套件
- 所有錯誤完整顯示在前端
- 禁止使用 `--accept-data-loss`，不可覆蓋資料庫資料
- README.md 永遠只有一份，不要創建新的 .md 文檔（CLAUDE.md 除外）

## 常用指令

```bash
pnpm dev              # 開發伺服器 (port 3000)
pnpm build            # 生產建構 (含 prisma generate)
pnpm lint             # ESLint
pnpm typecheck        # TypeScript 型別檢查
prisma generate       # 產生 Prisma Client
prisma db push        # 同步 schema 到資料庫（不可加 --accept-data-loss）
```

## 環境變數

需要 `DATABASE_URL`（Neon PostgreSQL）和 `JWT_SECRET`，參考 `.env.example`。

## 技術架構

- **Next.js 14 (App Router)** + TypeScript + Tailwind CSS
- **Prisma ORM** 連接 Neon PostgreSQL
- **認證**：jose JWT，HttpOnly Cookie（`auth-token`），有效期 7 天
- 部署目標：Vercel

## 認證架構（三層防護）

1. **Middleware** (`src/middleware.ts`)：路由層攔截，驗證 JWT，將用戶資訊注入 `x-user-role`、`x-user-student-id`、`x-user-name` headers
2. **API 層** (`src/lib/auth.ts` 的 `requireAdmin`)：從 headers 讀取用戶資訊做權限檢查
3. **前端** (`src/components/AuthProvider.tsx`)：React Context 提供登入狀態

雙角色：admin（硬編碼帳密 admin/peopleone）、student（學號=密碼）。學生只能存取 `/my-groups` 和 `/api/student/` 路由，管理員專用頁面定義在 middleware 的 `ADMIN_ONLY_PAGES`。

## 資料模型核心關係

- **多課程隔離**：Student、Group、GradeItem 都透過 `courseId` 關聯到 Course，同一學號可存在於不同課程
- **Account vs Student**：Account 是登入帳號（學號全域唯一），Student 是課程內的學生記錄（同課程內學號唯一）。學生加入課程時建立 Student 記錄
- **唯一約束**：`@@unique([studentId, courseId])` 在 Student、`@@unique([name, courseId])` 在 Group 和 GradeItem、`@@unique([studentId, gradeItemId])` 在 Grade
- 所有外鍵都設定 `onDelete: Cascade`

## 頁面路由對應

| 路由 | 角色 | 功能 |
|------|------|------|
| `/` | admin | 首頁，選擇課程（courseId 帶入 query string） |
| `/students?courseId=` | admin | 學生管理 |
| `/groups?courseId=` | admin | 分組管理 |
| `/grade-items?courseId=` | admin | 成績項目管理 |
| `/grades?courseId=` | admin | 成績登記（個人/分組模式） |
| `/my-groups` | student | 學生自助分組 |
| `/login` | public | 登入/註冊 |

## API 約定

- 管理員 API 的寫入操作都用 `requireAdmin(request)` 檢查
- 學生自助 API 在 `/api/student/groups`，使用 `action` 欄位區分操作（join-course、create、join、leave、update-role、set-leader）
- Prisma Client 單例在 `src/lib/prisma.ts`，開發環境掛在 globalThis 避免 hot reload 重複建立連線

## next.config.js

已關閉 `missingSuspenseWithCSRBailout` 檢查（使用 `useSearchParams` 的頁面需要）。

## 資料匯入腳本

`scripts/` 目錄下有多個 Node.js 腳本用於從 Excel 批量匯入學生名單，使用 `xlsx` 套件解析。
