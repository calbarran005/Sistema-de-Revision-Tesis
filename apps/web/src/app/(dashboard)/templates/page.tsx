'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { templatesApi, programsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { BookOpen, Plus, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', selectedProgram],
    queryFn: () => templatesApi.list(selectedProgram || undefined).then(r => r.data.data),
  });

  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list().then(r => r.data.data),
  });

  const canManage = ['ADMIN', 'COORDINATOR'].includes(user?.role || '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Documentos Patrón</h1>
          <p className="text-gray-500 text-sm">Templates institucionales de evaluación de tesis</p>
        </div>
        {canManage && (
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Subir Template
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} className="input-field w-auto">
          <option value="">Todos los programas</option>
          {(programs || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card p-6 animate-pulse h-40 bg-gray-50" />)}
        </div>
      ) : (templates || []).length === 0 ? (
        <div className="card p-16 text-center text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No hay documentos patrón</p>
          {canManage && <p className="text-sm mt-1">Sube el primer template institucional</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates || []).map((t: any) => (
            <div key={t.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/templates/${t.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-600" />
                </div>
                {t.isProcessed ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle size={12} /> Procesado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Clock size={12} /> Procesando
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
              <p className="text-xs text-gray-500 mb-3">{t.program?.name} · v{t.version}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{t._count?.sections || t.totalSections || 0} secciones</span>
                <span>{formatDate(t.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-blue-600">
                Ver estructura <ChevronRight size={12} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
