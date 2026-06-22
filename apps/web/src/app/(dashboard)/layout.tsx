'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useNotificationsStore } from '@/store/notifications.store';
import { notificationsApi } from '@/lib/api';
import { ChatbotWidget } from '@/components/chatbot/chatbot-widget';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      notificationsApi.getUnreadCount()
        .then((res) => setUnreadCount(res.data.data?.count || 0))
        .catch(() => {});
    }
  }, [isAuthenticated, setUnreadCount]);

  // Durante SSR y hasta que se monte, mostrar esqueleto en vez de null
  if (!mounted) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="w-64 bg-[#1e3a5f]" />
        <div className="flex-1 flex flex-col">
          <div className="h-16 bg-white border-b border-gray-200" />
          <div className="flex-1 p-6">
            <div className="h-8 bg-gray-100 rounded animate-pulse w-64 mb-4" />
            <div className="h-48 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} userRole={user.role} />
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
