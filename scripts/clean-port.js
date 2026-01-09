#!/usr/bin/env node

/**
 * 端口清理脚本
 *
 * 功能：
 * - 从 .env 文件读取 PORT 配置（默认 3000）
 * - 查找并终止占用该端口的进程
 * - 跨平台支持（Windows/macOS/Linux）
 *
 * 使用方式：
 * - node scripts/clean-port.js
 * - npm run kill-port
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 从 .env 文件读取端口配置
 * @returns {number} 端口号
 */
function getPortFromEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env 文件不存在，使用默认端口 3000');
    return 3000;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const portMatch = envContent.match(/^PORT=(\d+)$/m);

  if (portMatch) {
    const port = parseInt(portMatch[1], 10);
    console.log(`📋 从 .env 读取端口配置: ${port}`);
    return port;
  }

  console.log('⚠️  .env 中未找到 PORT 配置，使用默认端口 3000');
  return 3000;
}

/**
 * Windows 平台下终止占用端口的进程
 * @param {number} port - 端口号
 * @returns {boolean} 是否成功终止
 */
function killPortOnWindows(port) {
  try {
    // 使用 netstat 查找占用端口的进程 PID
    const netstatResult = execSync(
      `netstat -ano | findstr :${port}`,
      { encoding: 'utf-8' }
    );

    if (!netstatResult.trim()) {
      console.log(`✅ 端口 ${port} 未被占用`);
      return true;
    }

    // 解析 netstat 输出，提取所有 PID
    const lines = netstatResult.split('\n').filter(line => line.trim());
    const pids = new Set();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];

      // 跳过空 PID 和系统进程
      if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
        pids.add(pid);
      }
    }

    if (pids.size === 0) {
      console.log(`✅ 端口 ${port} 未被占用`);
      return true;
    }

    // 终止所有占用端口的进程
    let killedCount = 0;
    for (const pid of pids) {
      try {
        // 获取进程名称（用于日志）
        let processName = 'Unknown';
        try {
          const taskInfo = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
            encoding: 'utf-8'
          });
          if (taskInfo.trim()) {
            processName = taskInfo.split(',')[0].replace(/"/g, '');
          }
        } catch (e) {
          // 忽略获取进程名称失败
        }

        // 强制终止进程
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`  ✓ 已终止进程 [${processName}] PID: ${pid}`);
        killedCount++;
      } catch (error) {
        console.log(`  ⚠️  无法终止 PID ${pid}（可能已结束或需要管理员权限）`);
      }
    }

    if (killedCount > 0) {
      console.log(`✅ 已释放端口 ${port}（终止了 ${killedCount} 个进程）`);
      // 等待一小段时间确保端口被释放
      const sleep = new Promise(resolve => setTimeout(resolve, 500));
      // eslint-disable-next-line no-sync
      execSync('timeout /t 1 /nobreak', { stdio: 'ignore' });
    } else {
      console.log(`⚠️  未找到可终止的进程，端口 ${port} 可能仍被占用`);
    }

    return killedCount > 0;
  } catch (error) {
    // netstat 命令失败说明端口未被占用
    if (error.status && error.status !== 1) {
      console.log(`✅ 端口 ${port} 未被占用`);
      return true;
    }
    console.error(`❌ 清理端口 ${port} 时出错:`, error.message);
    return false;
  }
}

/**
 * Unix 平台下终止占用端口的进程（macOS/Linux）
 * @param {number} port - 端口号
 * @returns {boolean} 是否成功终止
 */
function killPortOnUnix(port) {
  try {
    // 使用 lsof 查找占用端口的进程
    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });

    if (!result.trim()) {
      console.log(`✅ 端口 ${port} 未被占用`);
      return true;
    }

    // 提取所有 PID
    const pids = result.trim().split('\n').filter(Boolean);

    // 终止所有进程
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`  ✓ 已终止 PID: ${pid}`);
      } catch (error) {
        console.log(`  ⚠️  无法终止 PID ${pid}`);
      }
    }

    console.log(`✅ 已释放端口 ${port}`);
    return true;
  } catch (error) {
    // lsof 命令失败说明端口未被占用
    console.log(`✅ 端口 ${port} 未被占用`);
    return true;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🧹 开始清理端口...\n');

  const port = getPortFromEnv();

  if (process.platform === 'win32') {
    killPortOnWindows(port);
  } else {
    killPortOnUnix(port);
  }

  console.log('\n✨ 端口清理完成');
}

// 运行脚本
main();
