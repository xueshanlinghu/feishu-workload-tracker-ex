import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "飞书人力占用记录系统",
  description: "记录每日工作人力占用情况",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
