import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Home() {
  // 重定向到工作负载记录页面
  redirect('/workload');
}
