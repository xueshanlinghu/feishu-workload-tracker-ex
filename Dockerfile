# 多阶段构建Dockerfile
FROM node:20-alpine AS base

# 依赖安装阶段
FROM base AS deps
WORKDIR /app

# 复制package文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app

# 从deps阶段复制node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# 构建Next.js应用
# 使用standalone输出模式以减小镜像体积
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制standalone输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
