'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { submissionsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getStatusConfig, getScoreColor, formatDate, truncate } from '@/lib/utils';
import { Plus, Search, Filter, Download, Eye, Brain, RefreshCw, Files } from 'lucide-react';

export default function SubmissionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['submissions', { search, status, page }],
    queryFn: () => submissionsApi.list({ search, status, page, limit: 15 }).then(r => r.data),
    refetchInterval: (query: any) => {
      const submissions = query.state?.data?.data;
      const hasProcessing = Array.isArray(submissions) &&
        submissions.some((s: any) => ['SUBMITTED', 'ANALYZING', 'IN_REVIEW'].includes(s.status));
      return hasProcessing ? 2500 : 8000;
    },
  });

  const submissions = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Avances de Tesis</h1>
          <p className="text-gray-500 text-sm">Gestiona los avances de los estudiantes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/submissions/batch')} className="px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-100 transition-colors">
            <Files size={16} /> Carga por Lote
          </button>
          {user?.role === 'STUDENT' && (
            <button onClick={() => router.push('/submissions/new')} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Subir Avance
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o estudiante..."
            className="input-field pl-9"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field w-auto min-w-[160px]">
          <option value="">Todos los estados</option>
          {['DRAFT','SUBMITTED','ANALYZING','PENDING_REVIEW','IN_REVIEW','OBSERVED','APPROVED','REJECTED'].map(s => (
            <option key={s} value={s}>{getStatusConfig(s).label}</option>
          ))}
        </select>
        <button onClick={() => refetch()} className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Estudiante / Título', 'Versión', 'Estado', 'IA Score', 'Nota IA', 'Nota Final', 'Fecha', 'Acciones'].map(h => (
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
                  <Brain size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay avances</p>
                  <p className="text-xs mt-1">Los avances subidos aparecerán aquí</p>
                </td></tr>
              ) : submissions.map((s: any) => {
                const statusCfg = getStatusConfig(s.status);
                const aiScore = s.aiAnalysis?.complianceScore;
                const finalGrade = s.humanReview?.adjustedGrade || s.aiAnalysis?.finalGrade;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/submissions/${s.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{truncate(s.title, 45)}</p>
                      <p className="text-xs text-gray-500">{s.student?.user?.firstName} {s.student?.user?.lastName}</p>
                      <p className="text-xs text-gray-400">{s.student?.program?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">v{s.versionNumber}</td>
                    <td className="px-4 py-3">
                      <span className="badge-status text-xs" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {['ANALYZING', 'SUBMITTED'].includes(s.status) && <span className="analyzing-dot mr-1 inline-block w-1.5 h-1.5 rounded-full bg-current" />}
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
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.aiAnalysis?.finalGrade ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#1e3a5f]">{finalGrade ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => router.push(`/submissions/${s.id}`)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Ver detalle">
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Mostrando {((page-1)*15)+1}-{Math.min(page*15, meta.total)} de {meta.total}</p>
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
