'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading CodeGuardian...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#020617] grid-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
