/**
 * 工作负载记录主页面
 *
 * 这是系统的核心页面，用户在这里：
 * 1. 选择日期和记录人员
 * 2. 查看已有记录
 * 3. 添加新的工作负载记录
 * 4. 提交到飞书多维表格
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  userId: string;    // user_id
  openId: string;    // open_id (用于飞书表格查询)
  name: string;
  email?: string;
  avatar?: string;
}

interface Task {
  name: string;
}

interface Record {
  id: string;
  task: string;
  workload: number;
  status: string;
}

interface NewRecord {
  task: string;
  workload: number;
}

export default function WorkloadPage() {
  const router = useRouter();

  // 状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [existingRecords, setExistingRecords] = useState<Record[]>([]);
  const [existingTotal, setExistingTotal] = useState<number>(0);
  const [newRecords, setNewRecords] = useState<NewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // 获取当前用户信息
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/login');
          return;
        }

        setCurrentUser(data.user);
        setSelectedPerson(data.user.openId); // 使用open_id查询表格记录
      } catch (err) {
        console.error('Failed to fetch session:', err);
        router.push('/login');
      }
    }

    fetchSession();
  }, [router]);

  // 获取用户列表和事项选项
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setIsLoading(true);

        const [usersRes, tasksRes] = await Promise.all([
          fetch('/api/feishu/users'),
          fetch('/api/feishu/tasks'),
        ]);

        // 检查会话是否过期（401 状态码）
        if (usersRes.status === 401 || tasksRes.status === 401) {
          console.log('Session expired, redirecting to login...');
          router.push('/login');
          return;
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData.tasks);
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setError('获取初始数据失败');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInitialData();
  }, [router]);

  // 当日期或人员变化时，获取已有记录
  useEffect(() => {
    if (!selectedDate || !selectedPerson) return;

    async function fetchRecords() {
      try {
        const res = await fetch(
          `/api/feishu/records?date=${selectedDate}&person=${selectedPerson}`
        );

        // 检查会话是否过期
        if (res.status === 401) {
          console.log('Session expired while fetching records, redirecting to login...');
          router.push('/login');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setExistingRecords(data.records);
          setExistingTotal(data.total);
        } else {
          setExistingRecords([]);
          setExistingTotal(0);
        }
      } catch (err) {
        console.error('Failed to fetch records:', err);
      }
    }

    fetchRecords();
  }, [selectedDate, selectedPerson, router]);

  // 添加新记录行
  const addNewRecord = () => {
    setNewRecords([...newRecords, { task: '', workload: 0.1 }]);
  };

  // 移除记录行
  const removeRecord = (index: number) => {
    setNewRecords(newRecords.filter((_, i) => i !== index));
  };

  // 更新记录
  const updateRecord = (index: number, field: 'task' | 'workload', value: string | number) => {
    const updated = [...newRecords];
    updated[index] = { ...updated[index], [field]: value };
    setNewRecords(updated);
  };

  // 计算新增总计
  const newTotal = newRecords.reduce((sum, r) => sum + r.workload, 0);
  const finalTotal = existingTotal + newTotal;

  // 提交记录
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      // 验证
      if (newRecords.length === 0) {
        setError('请至少添加一条记录');
        return;
      }

      if (newRecords.some(r => !r.task)) {
        setError('请填写所有事项');
        return;
      }

      if (finalTotal > 1.0) {
        setError('总人力占用不能超过1.0');
        return;
      }

      // 提交
      const res = await fetch('/api/feishu/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          personId: selectedPerson,
          records: newRecords,
        }),
      });

      // 检查会话是否过期
      if (res.status === 401) {
        console.log('Session expired while submitting, redirecting to login...');
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        // 在development模式显示详细错误
        if (process.env.NODE_ENV === 'development') {
          const detailedError = data.details ?
            `${data.error}\n\n详细信息：\n${JSON.stringify(data.details, null, 2)}` :
            data.error || '提交失败';
          throw new Error(detailedError);
        }
        throw new Error(data.error || '提交失败');
      }

      setSuccess('记录提交成功！');
      setNewRecords([]);

      // 刷新已有记录
      const refreshRes = await fetch(
        `/api/feishu/records?date=${selectedDate}&person=${selectedPerson}`
      );

      // 检查刷新请求的会话状态
      if (refreshRes.status === 401) {
        console.log('Session expired while refreshing, redirecting to login...');
        router.push('/login');
        return;
      }

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setExistingRecords(data.records);
        setExistingTotal(data.total);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 登出
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // 生成Emoji表情
  const getWorkloadEmojis = (workload: number): string => {
    // 如果工作负载为0，不显示任何表情
    if (workload === 0) {
      return '';
    }

    // 限制工作负载在 0-1 范围内显示
    const clampedWorkload = Math.max(0, Math.min(1, workload));
    const filled = Math.round(clampedWorkload * 10);

    // 只显示填充的表情，不显示空表情
    return '😄'.repeat(filled);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">人力占用记录</h1>
          <div className="flex items-center space-x-4">
            {currentUser && (
              <span className="text-gray-700">
                欢迎，{currentUser.name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 消息提示 */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* 日期和人员选择 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择日期
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择人员
              </label>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 请选择 --</option>
                {users.map((user) => (
                  <option key={user.openId} value={user.openId}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 已有记录 */}
        {existingRecords.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">已有记录</h2>
            <div className="space-y-3">
              {existingRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div className="flex-1">
                    <span className="font-medium">{record.task || '未命名任务'}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm">{getWorkloadEmojis(record.workload || 0)}</span>
                    <span className="font-semibold text-blue-600">
                      {(record.workload || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">已占用人力：</span>
                <span className="text-2xl font-bold text-blue-600">
                  {existingTotal.toFixed(1)} / 1.0
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 新增记录 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">新增记录</h2>
            <button
              onClick={addNewRecord}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + 添加记录
            </button>
          </div>

          {newRecords.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              点击"添加记录"按钮开始记录工作
            </p>
          ) : (
            <div className="space-y-4">
              {newRecords.map((record, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-1">
                    <select
                      value={record.task}
                      onChange={(e) => updateRecord(index, 'task', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- 选择事项 --</option>
                      {tasks.map((task) => (
                        <option key={task} value={task}>
                          {task}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-48">
                    <input
                      type="number"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={record.workload}
                      onChange={(e) => updateRecord(index, 'workload', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => removeRecord(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-700"
                  >
                    删除
                  </button>
                </div>
              ))}

              {/* 总计显示 */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>已有人力：</span>
                    <span className="font-semibold">{existingTotal.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>新增人力：</span>
                    <span className="font-semibold">{newTotal.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>总计：</span>
                    <span className={finalTotal > 1.0 ? 'text-red-600' : 'text-green-600'}>
                      {finalTotal.toFixed(1)} / 1.0
                    </span>
                  </div>
                </div>

                {finalTotal > 1.0 && (
                  <p className="mt-2 text-red-600 text-sm">
                    ⚠️ 总人力占用超过1.0，无法提交
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || finalTotal > 1.0 || newRecords.length === 0}
                  className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSubmitting ? '提交中...' : '提交记录'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
