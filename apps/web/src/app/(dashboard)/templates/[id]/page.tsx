'use client';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { templatesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, BookOpen, CheckCircle, Clock, AlertCircle, Layers, FileText } from 'lucide-react';

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['template', id],
    queryFn: () => templatesApi.get(id).then(r => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <div className="card p-6 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
        <p className="text-gray-600">No se pudo cargar el documento patrón.</p>
        <button onClick={() => router.back()} className="mt-4 btn-primary">Volver</button>
      </div>
    );
  }

  const sections: any[] = data.sections || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="section-title">{data.name}</h1>
          <p className="text-sm text-gray-500">{data.program?.name} · v{data.version}</p>
        </div>
      </div>

      {/* Info card */}
      <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">Estado</p>
          {data.isProcessed ? (
            <span className="flex items-center gap-1 text-green-700 text-sm font-medium">
              <CheckCircle size={14} /> Procesado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
              <Clock size={14} /> Pendiente
            </span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Secciones</p>
          <p className="text-sm font-semibold text-gray-800">{sections.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Archivo</p>
          <p className="text-sm font-medium text-gray-700 truncate">{data.fileName}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Creado</p>
          <p className="text-sm text-gray-700">{formatDate(data.createdAt)}</p>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="card p-5">
          <p className="text-sm text-gray-600">{data.description}</p>
        </div>
      )}

      {/* Sections */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Layers size={16} className="text-[#1e3a5f]" />
          <h2 className="font-semibold text-gray-800">Estructura del documento</h2>
        </div>

        {sections.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin secciones definidas</p>
            <p className="text-xs mt-1 max-w-sm mx-auto">
              Este template no tiene secciones configuradas. Sube el archivo real del documento patrón para que el sistema IA extraiga la estructura automáticamente.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sections.map((section: any, idx: number) => (
              <div key={section.id} className="px-5 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{section.title || section.name}</p>
                      {section.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                      )}
                      {section.contentGuidelines && (
                        <p className="text-xs text-gray-400 mt-1 italic">{section.contentGuidelines}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {section.isRequired && (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-medium">Obligatoria</span>
                    )}
                    {section.weight != null && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{section.weight}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rubrics */}
      {data.rubrics && data.rubrics.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Rúbricas de evaluación</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.rubrics.map((rubric: any) => (
              <div key={rubric.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{rubric.name}</p>
                  <span className="text-xs text-gray-500">{rubric.weight}% del total</span>
                </div>
                {rubric.description && <p className="text-sm text-gray-500 mt-1">{rubric.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
