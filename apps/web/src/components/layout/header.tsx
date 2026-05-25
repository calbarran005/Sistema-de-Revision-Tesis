'use client';
import { Bell, Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationsStore } from '@/store/notifications.store';

const roleLabel: Record<string, string> = { STUDENT: 'Estudiante', ADVISOR: 'Asesor', COORDINATOR: 'Coordinador', ADMIN: 'Administrador' };

export function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, logout } = useAuthStore();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-20">
      <div className="flex items-center gap-4">
        <button onClick={onMenuToggle} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Notificaciones */}
        <button
          onClick={() => router.push('/notifications')}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 bg-[#1e3a5f] rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-900 leading-none">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{roleLabel[user?.role || ''] || user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="ml-2 p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
