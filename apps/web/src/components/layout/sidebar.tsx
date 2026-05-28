'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, FileText, BookOpen, Users, BarChart3,
  Bell, ChevronLeft, ChevronRight, GraduationCap,
  FileSearch, ClipboardList, Brain, ScrollText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps { isOpen: boolean; onToggle: () => void; userRole: string; }

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/submissions', label: 'Avances', icon: FileText, roles: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/submissions/batch', label: 'Evaluación por Lotes', icon: Brain, roles: ['ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/templates', label: 'Documentos Patrón', icon: BookOpen, roles: ['ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/reviews', label: 'Revisiones', icon: ClipboardList, roles: ['ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/reports', label: 'Reportes', icon: FileSearch, roles: ['ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/statistics', label: 'Estadísticas', icon: BarChart3, roles: ['COORDINATOR', 'ADMIN'] },
  { href: '/users', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
  { href: '/thesis-generator', label: 'Generador de Tesis', icon: ScrollText, roles: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] },
  { href: '/notifications', label: 'Notificaciones', icon: Bell, roles: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] },
];

export function Sidebar({ isOpen, onToggle, userRole }: SidebarProps) {
  const pathname = usePathname();
  const filtered = navItems.filter((i) => i.roles.includes(userRole));

  return (
    <aside className={cn('fixed left-0 top-0 h-full bg-[#1e3a5f] text-white flex flex-col z-30 transition-all duration-300 shadow-xl', isOpen ? 'w-64' : 'w-16')}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          {isOpen && <span className="font-bold text-lg truncate">SisTesis</span>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {filtered.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link href={item.href} className={cn('sidebar-item', active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white')}>
                  <item.icon size={18} className="flex-shrink-0" />
                  {isOpen && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Toggle */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
    </aside>
  );
}
