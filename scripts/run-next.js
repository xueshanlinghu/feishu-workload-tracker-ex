#!/usr/bin/env node

/**
 * Next.js 启动脚本
 *
 * 功能：
 * - 从 .env 读取 PORT 配置（默认 3001）
 * - 使用明确的 -p 参数启动 next dev / next start
 * - 避免 Next.js 在本地开发时回退到默认 3000 端口
 *
 * 使用方式：
 * - node scripts/run-next.js dev
 * - node scripts/run-next.js start
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * 从 .env 文件读取端口配置
 * @returns {string} 端口号字符串
 */
function getPortFromEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env 文件不存在，使用默认端口 3001');
    return '3001';
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const portMatch = envContent.match(/^PORT=(\d+)$/m);

  if (portMatch) {
    return portMatch[1];
  }

  console.log('⚠️  .env 中未找到 PORT 配置，使用默认端口 3001');
  return '3001';
}

/**
 * 主函数
 */
function main() {
  const command = process.argv[2];

  if (!command || !['dev', 'start'].includes(command)) {
    console.error('❌ 仅支持以下命令：dev / start');
    process.exit(1);
  }

  const port = getPortFromEnv();
  const nextBin = require.resolve('next/dist/bin/next');
  const child = spawn(
    process.execPath,
    [nextBin, command, '-p', port],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: port,
      },
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main();
