/**
 * 工作负载记录主页面
 *
 * 这是系统的核心页面，用户在这里：
 * 1. 选择日期和记录人员
 * 2. 查看已有记录
 * 3. 按“类型 -> 内容 -> 细项”三级联动新增记录
 * 4. 提交到飞书多维表格
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import EditRecordModal from './EditRecordModal';
import CircularProgress from './CircularProgress';
import HoursMoodIcon from './HoursMoodIcon';
import { ToastProvider, useToast } from './ToastProvider';
import DeleteConfirmModal from './DeleteConfirmModal';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect, { SelectOption } from './CustomSelect';
import WorkloadSelector from './WorkloadSelector';
import packageJson from '../../package.json';
import {
  formatHoursValue,
  getDailyHoursStatus,
  hoursToWorkloadRatio,
  MAX_DAILY_HOURS,
  STANDARD_WORKDAY_HOURS,
} from '@/lib/work-hours';

const SESSION_HEARTBEAT_INTERVAL_MS = 45 * 60 * 1000;

interface User {
  userId: string;
  openId: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface CategoryItem {
  recordId: string;
  label: string;
}

interface CategoryResponse {
  items: CategoryItem[];
  total: number;
  requiresDetail?: boolean;
}

interface ExistingRecord {
  id: string;
  type: string;
  content: string;
  detail?: string;
  task: string;
  hours: number;
  status: string;
}

interface NewRecord {
  id: string;
  typeRecordId: string;
  contentRecordId: string;
  detailRecordId: string;
  hours: number;
  contentOptions: SelectOption[];
  detailOptions: SelectOption[];
  isLoadingContents: boolean;
  isLoadingDetails: boolean;
  detailRequired: boolean;
}

interface SessionUser {
  userId: string;
  openId: string;
  name: string;
  email?: string;
  avatar?: string;
}

function createEmptyRecord(): NewRecord {
  const recordId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: recordId,
    typeRecordId: '',
    contentRecordId: '',
    detailRecordId: '',
    hours: 0,
    contentOptions: [],
    detailOptions: [],
    isLoadingContents: false,
    isLoadingDetails: false,
    detailRequired: false,
  };
}

function toSelectOptions(items: CategoryItem[]): SelectOption[] {
  return items.map((item) => ({
    value: item.recordId,
    label: item.label,
    icon: 'file',
  }));
}

export default function WorkloadPage() {
  return (
    <ToastProvider>
      <WorkloadPageContent />
    </ToastProvider>
  );
}

function WorkloadPageContent() {
  const { showError, showSuccess } = useToast();
  const router = useRouter();

  const contentOptionsCacheRef = useRef<Record<string, SelectOption[]>>({});
  const detailOptionsCacheRef = useRef<
    Record<string, { items: SelectOption[]; requiresDetail: boolean }>
  >({});
  const hasTouchedPersonSelectRef = useRef(false);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [typeOptions, setTypeOptions] = useState<SelectOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [existingRecords, setExistingRecords] = useState<ExistingRecord[]>([]);
  const [existingTotalHours, setExistingTotalHours] = useState<number>(0);
  const [recordsRefreshToken, setRecordsRefreshToken] = useState(0);
  const [newRecords, setNewRecords] = useState<NewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingRecords, setIsFetchingRecords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExistingRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<ExistingRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateNewRecordState = (
    recordId: string,
    updater: (record: NewRecord) => NewRecord
  ) => {
    setNewRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.id === recordId ? updater(record) : record
      )
    );
  };

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!data.authenticated) {
        router.push('/login');
        return;
      }

      setCurrentUser(data.user);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      router.push('/login');
    }
  }, [router]);

  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [usersResponse, typesResponse] = await Promise.all([
        fetch('/api/feishu/users'),
        fetch('/api/feishu/categories?level=types'),
      ]);

      if (usersResponse.status === 401 || typesResponse.status === 401) {
        router.push('/login');
        return;
      }

      if (!usersResponse.ok || !typesResponse.ok) {
        throw new Error('获取初始数据失败');
      }

      const usersData = await usersResponse.json();
      const typesData = (await typesResponse.json()) as CategoryResponse;

      setUsers(usersData.users || []);
      setTypeOptions(toSelectOptions(typesData.items || []));
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      showError('获取初始数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [router, showError]);

  const fetchExistingRecords = useCallback(async (date: string, personId: string) => {
    try {
      setIsFetchingRecords(true);

      const response = await fetch(
        `/api/feishu/records?date=${date}&person=${personId}`
      );

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('获取记录失败');
      }

      const data = await response.json();
      setExistingRecords(data.records || []);
      setExistingTotalHours(data.totalHours || 0);
      setRecordsRefreshToken((current) => current + 1);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      setExistingRecords([]);
      setExistingTotalHours(0);
      setRecordsRefreshToken((current) => current + 1);
      showError('获取已有记录失败');
    } finally {
      setIsFetchingRecords(false);
    }
  }, [router, showError]);

  async function fetchCategoryResponse(url: string): Promise<CategoryResponse> {
    const response = await fetch(url);

    if (response.status === 401) {
      router.push('/login');
      throw new Error('登录状态已过期');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: '获取分类数据失败' }));
      throw new Error(data.error || '获取分类数据失败');
    }

    return response.json();
  }

  async function loadContentOptions(recordId: string, typeRecordId: string) {
    updateNewRecordState(recordId, (record) => ({
      ...record,
      typeRecordId,
      contentRecordId: '',
      detailRecordId: '',
      contentOptions: [],
      detailOptions: [],
      isLoadingContents: true,
      isLoadingDetails: false,
      detailRequired: false,
    }));

    try {
      const cachedOptions = contentOptionsCacheRef.current[typeRecordId];
      if (cachedOptions) {
        updateNewRecordState(recordId, (record) => {
          if (record.typeRecordId !== typeRecordId) {
            return record;
          }

          return {
            ...record,
            contentOptions: cachedOptions,
            isLoadingContents: false,
          };
        });
        return;
      }

      const data = await fetchCategoryResponse(
        `/api/feishu/categories?level=contents&typeRecordId=${typeRecordId}`
      );
      const options = toSelectOptions(data.items || []);
      contentOptionsCacheRef.current[typeRecordId] = options;

      updateNewRecordState(recordId, (record) => {
        if (record.typeRecordId !== typeRecordId) {
          return record;
        }

        return {
          ...record,
          contentOptions: options,
          isLoadingContents: false,
        };
      });
    } catch (error) {
      console.error('Failed to fetch content options:', error);
      updateNewRecordState(recordId, (record) => ({
        ...record,
        contentOptions: [],
        isLoadingContents: false,
      }));
      showError(error instanceof Error ? error.message : '获取内容选项失败');
    }
  }

  async function loadDetailOptions(recordId: string, contentRecordId: string) {
    updateNewRecordState(recordId, (record) => ({
      ...record,
      contentRecordId,
      detailRecordId: '',
      detailOptions: [],
      isLoadingDetails: true,
      detailRequired: false,
    }));

    try {
      const cachedDetails = detailOptionsCacheRef.current[contentRecordId];
      if (cachedDetails) {
        updateNewRecordState(recordId, (record) => {
          if (record.contentRecordId !== contentRecordId) {
            return record;
          }

          return {
            ...record,
            detailOptions: cachedDetails.items,
            detailRequired: cachedDetails.requiresDetail,
            isLoadingDetails: false,
          };
        });
        return;
      }

      const data = await fetchCategoryResponse(
        `/api/feishu/categories?level=details&contentRecordId=${contentRecordId}`
      );
      const cachedValue = {
        items: toSelectOptions(data.items || []),
        requiresDetail: Boolean(data.requiresDetail),
      };
      detailOptionsCacheRef.current[contentRecordId] = cachedValue;

      updateNewRecordState(recordId, (record) => {
        if (record.contentRecordId !== contentRecordId) {
          return record;
        }

        return {
          ...record,
          detailOptions: cachedValue.items,
          detailRequired: cachedValue.requiresDetail,
          isLoadingDetails: false,
        };
      });
    } catch (error) {
      console.error('Failed to fetch detail options:', error);
      updateNewRecordState(recordId, (record) => ({
        ...record,
        detailOptions: [],
        isLoadingDetails: false,
        detailRequired: false,
      }));
      showError(error instanceof Error ? error.message : '获取细项选项失败');
    }
  }

  const addNewRecord = () => {
    setNewRecords((currentRecords) => [...currentRecords, createEmptyRecord()]);
  };

  const removeRecord = (recordId: string) => {
    setNewRecords((currentRecords) =>
      currentRecords.filter((record) => record.id !== recordId)
    );
  };

  const handleTypeChange = async (recordId: string, typeRecordId: string) => {
    await loadContentOptions(recordId, typeRecordId);
  };

  const handleContentChange = async (recordId: string, contentRecordId: string) => {
    await loadDetailOptions(recordId, contentRecordId);
  };

  const handleDetailChange = (recordId: string, detailRecordId: string) => {
    updateNewRecordState(recordId, (record) => ({
      ...record,
      detailRecordId,
    }));
  };

  const handleHoursChange = (recordId: string, hours: number) => {
    updateNewRecordState(recordId, (record) => ({
      ...record,
      hours,
    }));
  };

  const refreshRecords = async () => {
    if (!selectedDate || !selectedPerson) {
      return;
    }

    await fetchExistingRecords(selectedDate, selectedPerson);
  };

  const handlePersonChange = (personOpenId: string) => {
    hasTouchedPersonSelectRef.current = true;
    setSelectedPerson(personOpenId);
  };

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let disposed = false;
    let intervalId: number | null = null;

    const refreshSession = async (source: 'interval' | 'visibility') => {
      try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });

        if (response.status === 401) {
          if (!disposed) {
            console.log(
              `[Session Heartbeat] Session expired on ${source}, redirecting to login...`
            );
            router.push('/login');
          }
          return;
        }

        if (!response.ok) {
          console.warn(
            `[Session Heartbeat] Refresh request failed on ${source}: ${response.status}`
          );
        }
      } catch (error) {
        console.error(`[Session Heartbeat] Refresh request error on ${source}:`, error);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession('visibility');
      }
    };

    intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshSession('interval');
      }
    }, SESSION_HEARTBEAT_INTERVAL_MS);

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentUser, router]);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!selectedDate || !selectedPerson) {
      return;
    }

    void fetchExistingRecords(selectedDate, selectedPerson);
  }, [fetchExistingRecords, selectedDate, selectedPerson]);

  useEffect(() => {
    if (selectedPerson || hasTouchedPersonSelectRef.current || !currentUser || users.length === 0) {
      return;
    }

    // 仅当登录人确实存在于人员列表时，才默认帮用户选中，避免误把无权限人员当成已选择。
    const matchedUser = users.find((user) => user.openId === currentUser.openId);
    if (matchedUser) {
      setSelectedPerson(matchedUser.openId);
    }
  }, [currentUser, selectedPerson, users]);

  const newTotalHours = newRecords.reduce((sum, record) => sum + record.hours, 0);
  const finalTotalHours = existingTotalHours + newTotalHours;
  const finalHoursStatus = getDailyHoursStatus(finalTotalHours);
  const hasSelectedPerson = Boolean(selectedPerson);
  const hasPendingCategoryLoad = newRecords.some(
    (record) => record.isLoadingContents || record.isLoadingDetails
  );
  const hasInvalidRecords = newRecords.some((record) => {
    if (!record.typeRecordId || !record.contentRecordId || record.hours === 0) {
      return true;
    }

    if (record.detailRequired && !record.detailRecordId) {
      return true;
    }

    return false;
  });

  const userOptions: SelectOption[] = users.map((user) => ({
    value: user.openId,
    label: user.name,
    icon: 'user',
  }));

  const finalHoursValueColor =
    finalHoursStatus === 'danger'
      ? 'text-red-600'
      : finalHoursStatus === 'warning'
        ? 'text-orange-500'
        : 'text-green-600';
  const finalHoursRatioColor =
    finalHoursStatus === 'danger'
      ? 'text-red-500'
      : finalHoursStatus === 'warning'
        ? 'text-orange-500'
        : 'text-gray-500';
  const finalHoursLimitColor =
    finalHoursStatus === 'danger'
      ? 'text-red-600'
      : finalHoursStatus === 'warning'
        ? 'text-orange-500'
        : 'text-green-600';

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (newRecords.length === 0) {
        showError('请至少添加一条记录');
        return;
      }

      if (!hasSelectedPerson) {
        showError('请先选择人员后再提交记录');
        return;
      }

      if (hasPendingCategoryLoad) {
        showError('请等待分类选项加载完成后再提交');
        return;
      }

      if (hasInvalidRecords) {
        showError('请完善所有记录的分类和工时');
        return;
      }

      if (finalTotalHours > MAX_DAILY_HOURS) {
        showError(`总工时不能超过 ${MAX_DAILY_HOURS} 小时`);
        return;
      }

      const response = await fetch('/api/feishu/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          personId: selectedPerson,
          records: newRecords.map((record) => ({
            typeRecordId: record.typeRecordId,
            contentRecordId: record.contentRecordId,
            detailRecordId: record.detailRequired ? record.detailRecordId : undefined,
            hours: record.hours,
          })),
        }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '提交失败');
      }

      showSuccess('记录提交成功！');
      setNewRecords([]);
      await refreshRecords();
    } catch (error) {
      showError(error instanceof Error ? error.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const openEditModal = (record: ExistingRecord) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  const handleEditSuccess = async () => {
    showSuccess('记录更新成功！');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await refreshRecords();
  };

  const handleEditError = (errorMessage: string) => {
    showError(errorMessage);
  };

  const openDeleteModal = (record: ExistingRecord) => {
    setDeletingRecord(record);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingRecord(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) {
      return;
    }

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/feishu/records/${deletingRecord.id}`, {
        method: 'DELETE',
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      showSuccess('记录删除成功！');
      closeDeleteModal();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refreshRecords();
    } catch (error) {
      showError(error instanceof Error ? error.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const getHoursRatioText = (hours: number): string => {
    return `${hoursToWorkloadRatio(hours).toFixed(1)} 人天`;
  };

  const getHoursCardStyle = (hours: number) => {
    const percentage = (hours / MAX_DAILY_HOURS) * 100;

    if (percentage >= 70) {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        textColor: 'text-orange-700',
        iconBg: 'bg-orange-100',
      };
    }

    if (percentage >= 40) {
      return {
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        textColor: 'text-sky-700',
        iconBg: 'bg-sky-100',
      };
    }

    return {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      textColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
    };
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-5 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-black tracking-tight">人力占用记录 EX</h1>
          <div className="flex items-center space-x-4">
            {currentUser && (
              <span className="text-gray-700 font-medium">欢迎，{currentUser.name}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-all duration-200 font-medium hover:shadow-md"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-10">
        <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomDatePicker
              label="选择日期"
              value={selectedDate}
              onChange={setSelectedDate}
              disabled={isFetchingRecords || isSubmitting}
            />
            <CustomSelect
              label="选择人员"
              value={selectedPerson}
              onChange={handlePersonChange}
              options={userOptions}
              placeholder="-- 请选择人员 --"
              disabled={isFetchingRecords || isSubmitting}
              searchable={true}
              showIcon={true}
            />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 mb-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">已有记录</h2>
            <button
              onClick={() => {
                void refreshRecords();
              }}
              disabled={isFetchingRecords}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                isFetchingRecords
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 hover:shadow-md'
              }`}
              aria-label="刷新记录"
            >
              <svg
                className={`w-5 h-5 ${isFetchingRecords ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          {isFetchingRecords && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">正在获取记录中...</p>
            </div>
          )}

          {!isFetchingRecords && existingRecords.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-500">当日记录为空</p>
            </div>
          )}

          {!isFetchingRecords && existingRecords.length > 0 && (
            <>
              <div className="space-y-4">
                {existingRecords.map((record) => {
                  const cardStyle = getHoursCardStyle(record.hours || 0);
                  return (
                    <div
                      key={record.id}
                      className={`flex items-center justify-between p-5 ${cardStyle.bg} border ${cardStyle.border} rounded-xl transition-all duration-300 group hover:shadow-md hover:-translate-y-0.5`}
                    >
                      <div className="flex-1">
                        <span
                          title={record.task || '未命名记录'}
                          className="font-semibold text-gray-800"
                        >
                          {record.task || '未命名记录'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center gap-3">
                          <HoursMoodIcon
                            hours={record.hours || 0}
                            active={true}
                            size={18}
                            className="h-10 w-10"
                          />
                          <span className="text-right">
                            <span className={`block min-w-[72px] text-lg font-bold ${cardStyle.textColor}`}>
                              {formatHoursValue(record.hours || 0)} 小时
                            </span>
                            <span className="block text-xs text-gray-500">
                              约 {getHoursRatioText(record.hours || 0)}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(record)}
                            className={`p-2 ${cardStyle.iconBg} text-current rounded-lg transition-all duration-200 hover:scale-110`}
                            aria-label="编辑"
                            title="编辑"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(record)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg transition-all duration-200 hover:bg-red-200 hover:scale-110"
                            aria-label="删除"
                            title="删除"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">已占用工时</h3>
                </div>
                <div className="flex justify-center">
                  <CircularProgress
                    current={existingTotalHours}
                    max={STANDARD_WORKDAY_HOURS}
                    refreshToken={recordsRefreshToken}
                    size={140}
                    strokeWidth={12}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">新增记录</h2>
            <button
              onClick={addNewRecord}
              disabled={isFetchingRecords || isSubmitting || !hasSelectedPerson}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isFetchingRecords || isSubmitting || !hasSelectedPerson
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-md hover:shadow-lg hover:scale-105'
              }`}
            >
              + 添加记录
            </button>
          </div>

          {newRecords.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-gray-400 mb-3">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">
                点击&quot;添加记录&quot;按钮开始记录工作
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {newRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors duration-200"
                >
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(140px,0.85fr)_minmax(180px,1.15fr)_minmax(180px,1.15fr)_minmax(160px,0.95fr)_auto] lg:items-start 2xl:grid-cols-[minmax(180px,0.9fr)_minmax(260px,1.25fr)_minmax(260px,1.25fr)_minmax(210px,0.95fr)_auto]">
                    <CustomSelect
                      label="类型"
                      value={record.typeRecordId}
                      onChange={(value) => {
                        void handleTypeChange(record.id, value);
                      }}
                      options={typeOptions}
                      placeholder="-- 选择类型 --"
                      disabled={isFetchingRecords || isSubmitting}
                      searchable={true}
                      showIcon={true}
                    />
                    <CustomSelect
                      label="内容"
                      value={record.contentRecordId}
                      onChange={(value) => {
                        void handleContentChange(record.id, value);
                      }}
                      options={record.contentOptions}
                      placeholder={
                        !record.typeRecordId
                          ? '-- 请先选择类型 --'
                          : record.isLoadingContents
                            ? '-- 内容加载中 --'
                            : '-- 选择内容 --'
                      }
                      disabled={isFetchingRecords || isSubmitting || !record.typeRecordId}
                      loading={record.isLoadingContents}
                      searchable={true}
                      showIcon={true}
                    />
                    <CustomSelect
                      label="细项"
                      value={record.detailRecordId}
                      onChange={(value) => handleDetailChange(record.id, value)}
                      options={record.detailOptions}
                      placeholder={
                        !record.contentRecordId
                          ? '-- 请先选择内容 --'
                          : record.isLoadingDetails
                            ? '-- 细项加载中 --'
                            : !record.detailRequired
                              ? '-- 当前内容无细项 --'
                              : '-- 选择细项 --'
                      }
                      disabled={
                        isFetchingRecords ||
                        isSubmitting ||
                        !record.contentRecordId ||
                        !record.detailRequired
                      }
                      loading={record.isLoadingDetails}
                      searchable={true}
                      showIcon={true}
                    />
                    <div className="lg:pt-8 min-w-0">
                      <WorkloadSelector
                        value={record.hours}
                        onChange={(value) => handleHoursChange(record.id, value)}
                        disabled={isFetchingRecords || isSubmitting}
                        mode="dropdown"
                      />
                    </div>
                    <div className="lg:pt-8 lg:flex lg:justify-end">
                      <button
                        onClick={() => removeRecord(record.id)}
                        className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200 font-medium"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {record.contentRecordId &&
                    !record.isLoadingDetails &&
                    !record.detailRequired && (
                      <p className="mt-3 text-sm text-amber-600">
                        当前内容没有细项，可直接提交“类型 + 内容 + 工时”记录。
                      </p>
                    )}
                </div>
              ))}

              <div className="mt-8 pt-6 border-t-2 border-gray-200">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">已排工时：</span>
                    <span className="text-right">
                      <span className="block text-lg font-bold text-gray-800">
                        {formatHoursValue(existingTotalHours)} 小时
                      </span>
                      <span className="block text-xs text-gray-500">
                        约 {getHoursRatioText(existingTotalHours)}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">新增工时：</span>
                    <span className="text-right">
                      <span className="block text-lg font-bold text-gray-800">
                        {formatHoursValue(newTotalHours)} 小时
                      </span>
                      <span className="block text-xs text-gray-500">
                        约 {getHoursRatioText(newTotalHours)}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-blue-200">
                    <span className="text-lg font-bold text-gray-900">总计：</span>
                    <span className="text-right">
                      <span className="block text-2xl font-bold">
                        <span className={finalHoursValueColor}>
                          {formatHoursValue(finalTotalHours)}
                        </span>
                        <span className={finalHoursLimitColor}> / {STANDARD_WORKDAY_HOURS} 小时</span>
                      </span>
                      <span className={`block text-xs ${finalHoursRatioColor}`}>
                        约 {getHoursRatioText(finalTotalHours)}
                      </span>
                    </span>
                  </div>
                </div>

                {finalTotalHours > MAX_DAILY_HOURS && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="font-medium">总工时超过 14 小时，无法提交</span>
                  </div>
                )}

                {finalTotalHours > STANDARD_WORKDAY_HOURS &&
                  finalTotalHours <= MAX_DAILY_HOURS && (
                    <div className="mt-4 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl flex items-center">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span className="font-medium">总工时已超过 8 小时标准工时，可提交，但请留意当天安排</span>
                    </div>
                  )}

                {hasPendingCategoryLoad && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="font-medium">请等待内容或细项加载完成后再提交</span>
                  </div>
                )}

                {hasInvalidRecords && !hasPendingCategoryLoad && (
                  <div className="mt-4 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="font-medium">
                      请完善所有记录（选择类型、内容、必要时选择细项，并设置工时）
                    </span>
                  </div>
                )}

                <button
                  onClick={() => {
                    void handleSubmit();
                  }}
                  disabled={
                    isSubmitting ||
                    isFetchingRecords ||
                    !hasSelectedPerson ||
                    hasPendingCategoryLoad ||
                    finalTotalHours > MAX_DAILY_HOURS ||
                    newRecords.length === 0 ||
                    hasInvalidRecords
                  }
                  className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-500 font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                >
                  {isSubmitting ? '提交中...' : '提交记录'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-sm text-gray-500 border-t border-gray-200 bg-white/50">
        <p>版本 v{packageJson.version}</p>
      </footer>

      <EditRecordModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        record={editingRecord}
        onSuccess={handleEditSuccess}
        onError={handleEditError}
        currentTotalHours={existingTotalHours}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        title="确认删除记录"
        message={`确定要删除"${deletingRecord?.task || '该'}"记录吗？此操作无法撤销。`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
