import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  // 隔离dev与build产物目录，避免并发运行时互相覆盖chunk
  distDir: isDev ? '.next-dev' : '.next',

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
