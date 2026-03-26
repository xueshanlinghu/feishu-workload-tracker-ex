import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "人力占用记录 | feishu-workload-tracker-ex",
  description: "基于飞书多维表格的三级分类人力占用记录系统",
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
