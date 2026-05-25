'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useNotificationsStore } from '@/store/notifications.store';
import { Bell, CheckCheck } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { markAllRead } = useNotificationsStore();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 50 }).then(r => r.data.data),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { markAllRead(); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const notifications = data?.data || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Notificaciones</h1>
        {notifications.some((n: any) => !n.isRead) && (
          <button onClick={() => markAll.mutate()} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <CheckCheck size={14} /> Marcar todas como leídas
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card p-4 animate-pulse h-16" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="card p-16 text-center text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Sin notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div key={n.id} className={`card p-4 flex gap-3 ${!n.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.isRead ? 'bg-gray-200' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${n.isRead ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
