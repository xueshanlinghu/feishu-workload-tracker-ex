/**
 * 配置管理
 * 从环境变量中读取配置，并进行验证
 */

interface Config {
  feishu: {
    appId: string;
    appSecret: string;
    appToken: string;
    typeTableId: string;
    contentTableId: string;
    detailTableId: string;
    recordTableId: string;
    departmentId: string;
    apiBaseUrl: string;
    redirectUri: string;
  };
  app: {
    url: string;
    sessionSecret: string;
    nodeEnv: string;
  };
}

/**
 * 验证必需的环境变量
 */
function validateEnv(): void {
  const required = [
    'FEISHU_APP_ID',
    'FEISHU_APP_SECRET',
    'FEISHU_APP_TOKEN',
    'FEISHU_TYPE_TABLE_ID',
    'FEISHU_CONTENT_TABLE_ID',
    'FEISHU_DETAIL_TABLE_ID',
    'FEISHU_RECORD_TABLE_ID',
    'FEISHU_DEPARTMENT_ID',
    'SESSION_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `缺少必需的环境变量: ${missing.join(', ')}\n` +
      `请在 .env 文件中配置这些变量。`
    );
  }
}

// 验证环境变量
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

/**
 * 应用配置对象
 */
export const config: Config = {
  feishu: {
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    appToken: process.env.FEISHU_APP_TOKEN || '',
    typeTableId: process.env.FEISHU_TYPE_TABLE_ID || '',
    contentTableId: process.env.FEISHU_CONTENT_TABLE_ID || '',
    detailTableId: process.env.FEISHU_DETAIL_TABLE_ID || '',
    recordTableId: process.env.FEISHU_RECORD_TABLE_ID || '',
    departmentId: process.env.FEISHU_DEPARTMENT_ID || '',
    apiBaseUrl: process.env.FEISHU_API_BASE_URL || 'https://open.feishu.cn',
    redirectUri: process.env.FEISHU_REDIRECT_URI || 'http://localhost:3001/auth/callback',
  },
  app: {
    url: process.env.NEXTAUTH_URL || 'http://localhost:3001',
    sessionSecret: process.env.SESSION_SECRET || '',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
};
