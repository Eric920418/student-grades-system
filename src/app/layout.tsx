import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

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
        <AuthProvider>
          <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
