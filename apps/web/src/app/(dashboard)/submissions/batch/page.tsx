'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { submissionsApi, aiApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, getStatusConfig } from '@/lib/utils';
import {
  Brain, Loader2, CheckCircle, AlertCircle, ChevronRight,
  FileText, User, RefreshCw, CheckSquare, Square,
} from 'lucide-react';

export default function BatchAiEvaluationPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);

  const canAccess = ['ADVISOR', 'COORDINATOR', 'ADMIN'].includes(user?.role || '');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['submissions-pending-ai'],
    queryFn: () =>
      submissionsApi
        .list({ status: 'SUBMITTED', limit: 100 })
        .then((r) => r.data.data),
    enabled: canAccess,
  });

  const submissions: any[] = data || [];

  const batchMutation = useMutation({
    mutationFn: () => aiApi.startBatchAnalysis(Array.from(selected)),
    onSuccess: (res) => {
      setResult(res.data.data);
      setSelected(new Set());
      refetch();
    },
  });

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === submissions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(submissions.map((s) => s.id)));
    }
  };

  if (!canAccess) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso restringido</h2>
        <p className="text-gray-500">Solo asesores, coordinadores y administradores pueden realizar evaluaciones por lotes.</p>
        <button onClick={() => router.push('/submissions')} className="mt-6 btn-primary">
          Volver a avances
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Evaluación en cola</h2>
          <p className="text-gray-500 mb-6">
            Se han encolado {result.queued} avances para evaluación IA.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total procesados:</span>
              <span className="font-bold">{result.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Encolados exitosamente:</span>
              <span className="font-bold text-green-600">{result.queued}</span>
            </div>
            {result.failed > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Fallidos:</span>
                <span className="font-bold text-red-600">{result.failed}</span>
              </div>
            )}
            {result.errors?.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold text-red-700 mb-1">Errores:</p>
                <ul className="text-xs text-red-500 space-y-1">
                  {result.errors.map((e: any, i: number) => (
                    <li key={i}>• {e.submissionId}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/submissions')} className="btn-primary">
              Ver avances
            </button>
            <button
              onClick={() => { setResult(null); refetch(); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Evaluar más
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="section-title">Evaluación IA por Lotes</h1>
          <p className="text-gray-500 text-sm">
            Selecciona los avances que deseas evaluar con IA. Solo aparecen avances pendientes de evaluación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Brain size={12} /> IA Habilitada
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Actualizar lista"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Actions bar */}
      {submissions.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={toggleAll} className="text-gray-500 hover:text-gray-700">
              {selected.size === submissions.length
                ? <CheckSquare size={20} className="text-purple-600" />
                : <Square size={20} />}
            </button>
            <span className="text-sm text-gray-600">
              {selected.size === 0
                ? `${submissions.length} avance${submissions.length !== 1 ? 's' : ''} disponibles`
                : `${selected.size} seleccionado${selected.size !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={() => batchMutation.mutate()}
            disabled={selected.size === 0 || batchMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {batchMutation.isPending
              ? <><Loader2 size={15} className="animate-spin" /> Procesando...</>
              : <><Brain size={15} /> Evaluar {selected.size > 0 ? selected.size : ''} con IA</>}
          </button>
        </div>
      )}

      {/* Submissions list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin text-purple-500" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium text-gray-600">No hay avances pendientes de evaluación IA</p>
          <p className="text-sm mt-1">Todos los avances subidos ya han sido evaluados o están en proceso.</p>
          <button
            onClick={() => router.push('/submissions')}
            className="mt-4 flex items-center gap-2 text-sm text-purple-600 mx-auto hover:underline"
          >
            Ver todos los avances <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Avance</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estudiante</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Período</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Enviado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((s: any) => {
                const isSelected = selected.has(s.id);
                const statusCfg = getStatusConfig(s.status);
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-purple-50' : ''}`}
                    onClick={() => toggleOne(s.id)}
                  >
                    <td className="px-4 py-3">
                      {isSelected
                        ? <CheckSquare size={18} className="text-purple-600" />
                        : <Square size={18} className="text-gray-300" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{s.title}</p>
                          <p className="text-xs text-gray-400">{s.template?.name} · v{s.versionNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <User size={14} className="text-gray-400" />
                        <span>{s.student?.user?.firstName} {s.student?.user?.lastName}</span>
                      </div>
                      <p className="text-xs text-gray-400 ml-5">{s.student?.program?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.academicPeriod}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/submissions/${s.id}`); }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Ver detalle"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {batchMutation.isPending && (
        <div className="card p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-purple-500" />
            <div>
              <p className="font-semibold text-purple-800 text-sm">Encolando evaluaciones...</p>
              <p className="text-xs text-purple-600">
                Se están programando {selected.size} evaluaciones IA. El proceso puede tomar varios minutos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
