import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 启用standalone输出模式，用于Docker部署
  output: 'standalone',

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.feishu.cn',
      },
      {
        protocol: 'https',
        hostname: '**.larksuite.com',
      },
    ],
  },
}

export default nextConfig
