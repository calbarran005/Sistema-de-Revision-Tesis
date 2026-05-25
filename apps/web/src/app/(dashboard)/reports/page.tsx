'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { submissionsApi, reportsApi } from '@/lib/api';
import { FileSearch, Download, Loader2 } from 'lucide-react';
import { getStatusConfig, formatDate, truncate } from '@/lib/utils';

export default function ReportsPage() {
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['submissions-for-reports', search],
    queryFn: () => submissionsApi.list({ search, status: 'APPROVED', limit: 20 }).then(r => r.data.data),
  });

  const download = async (id: string, title: string) => {
    setDownloading(id);
    try {
      const res = await reportsApi.downloadIndividual(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `acta-revision-${title.slice(0, 30)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Reportes</h1>
        <p className="text-gray-500 text-sm">Genera y descarga actas de revisión en PDF</p>
      </div>

      <div className="card p-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar avance por título o estudiante..."
          className="input-field"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileSearch size={16} /> Actas de Revisión Individual
          </h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
        ) : (data?.data || []).length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <FileSearch size={40} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No hay avances aprobados disponibles</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Avance', 'Estudiante', 'Estado', 'Fecha', 'Acta'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.data || []).map((s: any) => {
                const sc = getStatusConfig(s.status);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{truncate(s.title, 40)}</p>
                      <p className="text-xs text-gray-400">v{s.versionNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.student?.user?.firstName} {s.student?.user?.lastName}</td>
                    <td className="px-4 py-3">
                      <span className="badge-status text-xs" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => download(s.id, s.title)}
                        disabled={downloading === s.id}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        {downloading === s.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        Descargar PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
