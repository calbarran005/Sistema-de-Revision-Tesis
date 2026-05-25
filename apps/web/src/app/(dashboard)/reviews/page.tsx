'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { submissionsApi } from '@/lib/api';
import { getStatusConfig, getScoreColor, formatDate, truncate } from '@/lib/utils';
import { Search, ClipboardList, Eye, RefreshCw, Brain } from 'lucide-react';

export default function ReviewsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['submissions-reviews', { search, status, page }],
    queryFn: () => submissionsApi.list({ search, status, page, limit: 15 }).then(r => r.data),
    refetchInterval: 15000,
  });

  const submissions = data?.data || [];
  const meta = data?.meta;

  const reviewStatuses = ['PENDING_REVIEW', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Revisiones Pendientes</h1>
          <p className="text-gray-500 text-sm">Avances que requieren revisión humana</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por título o estudiante..."
            className="input-field pl-9"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-auto min-w-[180px]">
          <option value="">Todos los estados</option>
          {reviewStatuses.map(s => (
            <option key={s} value={s}>{getStatusConfig(s).label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Estudiante / Título', 'Programa', 'Versión', 'Estado', 'Score IA', 'Nota IA', 'Enviado', 'Acción'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-8 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : submissions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                  <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay revisiones pendientes</p>
                  <p className="text-xs mt-1">Los avances listos para revisar aparecerán aquí</p>
                </td></tr>
              ) : submissions.map((s: any) => {
                const statusCfg = getStatusConfig(s.status);
                const aiScore = s.aiAnalysis?.complianceScore;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/submissions/${s.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{truncate(s.title, 40)}</p>
                      <p className="text-xs text-gray-500">{s.student?.user?.firstName} {s.student?.user?.lastName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.student?.program?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">v{s.versionNumber}</td>
                    <td className="px-4 py-3">
                      <span className="badge-status text-xs" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {aiScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${aiScore}%`, background: getScoreColor(aiScore) }} />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: getScoreColor(aiScore) }}>{aiScore}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                          <Brain size={12} />
                          <span>Sin análisis</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.aiAnalysis?.finalGrade ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/submissions/${s.id}`); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                      >
                        <Eye size={12} /> Revisar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Mostrando {((page-1)*15)+1}–{Math.min(page*15, meta.total)} de {meta.total}</p>
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
