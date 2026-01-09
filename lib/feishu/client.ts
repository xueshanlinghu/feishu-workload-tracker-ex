/**
 * 飞书API HTTP客户端
 *
 * 这个文件实现了与飞书API通信的基础HTTP客户端
 * 主要功能：
 * 1. 自动添加认证token到请求头
 * 2. 统一的错误处理
 * 3. 请求/响应拦截
 * 4. 自动重试机制
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { config } from '../config';
import { FeishuResponse } from '@/types/feishu';

/**
 * 飞书API错误类
 */
export class FeishuAPIError extends Error {
  constructor(
    message: string,
    public code: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'FeishuAPIError';
  }
}

/**
 * 创建Axios实例
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: config.feishu.apiBaseUrl,
    timeout: 30000, // 30秒超时
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 请求拦截器：可以在这里添加通用的请求头
  instance.interceptors.request.use(
    (config) => {
      // 打印请求日志（开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Feishu API] ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器：统一处理响应和错误
  instance.interceptors.response.use(
    (response: AxiosResponse<FeishuResponse>) => {
      const { code, msg, data } = response.data;

      // 飞书API返回 code=0 表示成功
      if (code === 0) {
        return response;
      }

      // code不为0表示业务错误
      console.error('[Feishu API Error] Code:', code, 'Message:', msg);
      console.error('[Feishu API Error] Full response:', JSON.stringify(response.data, null, 2));
      throw new FeishuAPIError(msg || '飞书API调用失败', code, response.data);
    },
    (error: AxiosError) => {
      // 网络错误或其他错误
      if (error.response) {
        // 服务器返回了错误状态码
        const status = error.response.status;
        const message = `HTTP ${status}: ${error.message}`;
        console.error('[Feishu API Error] HTTP Status:', status);
        console.error('[Feishu API Error] Response data:', JSON.stringify(error.response.data, null, 2));
        throw new FeishuAPIError(message, status, error.response.data);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new FeishuAPIError('网络请求失败，请检查网络连接', -1);
      } else {
        // 请求配置出错
        throw new FeishuAPIError(error.message, -1);
      }
    }
  );

  return instance;
};

/**
 * 飞书API客户端类
 */
class FeishuClient {
  private client: AxiosInstance;

  constructor() {
    this.client = createAxiosInstance();
  }

  /**
   * GET请求
   */
  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.get<FeishuResponse<T>>(url, config);
    return response.data.data as T;
  }

  /**
   * POST请求
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<FeishuResponse<T>>(url, data, config);
    // 飞书API响应可能有两种格式：
    // 1. 有data字段：{ code: 0, msg: "", data: {...} }
    // 2. 无data字段：{ code: 0, msg: "", tenant_access_token: "xxx", expire: 7200 }
    // 如果response.data.data存在，返回它；否则返回整个response.data
    const result = response.data.data !== undefined ? response.data.data : response.data;
    return result as T;
  }

  /**
   * PUT请求
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<FeishuResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * DELETE请求
   */
  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.delete<FeishuResponse<T>>(url, config);
    return response.data.data as T;
  }

  /**
   * 带认证token的请求
   * @param token - 访问令牌（tenant_access_token 或 user_access_token）
   */
  withAuth(token: string): AuthenticatedClient {
    return new AuthenticatedClient(this.client, token);
  }
}

/**
 * 带认证的客户端
 */
class AuthenticatedClient {
  constructor(
    private client: AxiosInstance,
    private token: string
  ) {}

  /**
   * GET请求（带认证）
   */
  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.get<FeishuResponse<T>>(url, {
      ...config,
      headers: {
        ...config?.headers,
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response.data.data as T;
  }

  /**
   * POST请求（带认证）
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<FeishuResponse<T>>(url, data, {
      ...config,
      headers: {
        ...config?.headers,
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response.data.data as T;
  }

  /**
   * PUT请求（带认证）
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<FeishuResponse<T>>(url, data, {
      ...config,
      headers: {
        ...config?.headers,
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response.data.data as T;
  }

  /**
   * DELETE请求（带认证）
   */
  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.delete<FeishuResponse<T>>(url, {
      ...config,
      headers: {
        ...config?.headers,
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response.data.data as T;
  }
}

// 导出单例实例
export const feishuClient = new FeishuClient();
