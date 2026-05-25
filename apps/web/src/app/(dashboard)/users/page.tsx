'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Search, Users, UserPlus, Shield, GraduationCap, BookOpen, Settings, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  STUDENT:     { label: 'Estudiante',    color: '#2563eb', bg: '#eff6ff', Icon: GraduationCap },
  ADVISOR:     { label: 'Asesor',        color: '#7c3aed', bg: '#f5f3ff', Icon: BookOpen },
  COORDINATOR: { label: 'Coordinador',   color: '#0891b2', bg: '#ecfeff', Icon: Shield },
  ADMIN:       { label: 'Administrador', color: '#dc2626', bg: '#fef2f2', Icon: Settings },
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', { search, role, page }],
    queryFn: () => usersApi.list({ search, role, page, limit: 15 }).then(r => r.data),
  });

  const users: any[] = data?.data ?? [];
  const meta = data?.meta;

  const deactivate = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const activate = useMutation({
    mutationFn: (id: string) => usersApi.update(id, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Usuarios del Sistema</h1>
          <p className="text-gray-500 text-sm">Gestión de cuentas y roles</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(ROLE_CONFIG).map(([roleKey, cfg]) => {
          const count = users.filter((u: any) => u.role === roleKey).length;
          return (
            <button
              key={roleKey}
              onClick={() => setRole(role === roleKey ? '' : roleKey)}
              className={`card p-4 text-left transition-all ${role === roleKey ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <cfg.Icon size={16} style={{ color: cfg.color }} />
                <span className="text-xs font-medium text-gray-500">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o email..."
            className="input-field pl-9"
          />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="input-field w-auto min-w-[160px]">
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Usuario', 'Rol', 'Estado', 'Último acceso', 'Registro', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-8 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No se encontraron usuarios</p>
                </td></tr>
              ) : users.map((u: any) => {
                const cfg = ROLE_CONFIG[u.role] ?? { label: u.role, color: '#6b7280', bg: '#f9fafb', Icon: Users };
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: cfg.color }}>
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                        <cfg.Icon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle size={12} /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <XCircle size={12} /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Nunca'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <button
                          onClick={() => deactivate.mutate(u.id)}
                          className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => activate.mutate(u.id)}
                          className="text-xs px-2 py-1 text-green-700 border border-green-200 rounded hover:bg-green-50"
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Página {page} de {meta.totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={() => setPage(p => p-1)} className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <button disabled={page===meta.totalPages} onClick={() => setPage(p => p+1)} className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
