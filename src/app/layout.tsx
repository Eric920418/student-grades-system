import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "學生成績管理系統",
  description: "學生分組與成績記錄管理工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-50 min-h-screen">
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}