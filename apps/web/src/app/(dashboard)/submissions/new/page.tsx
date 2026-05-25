'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { submissionsApi, templatesApi, programsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { bytesToMB } from '@/lib/utils';
import { Upload, FileText, X, CheckCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const schema = z.object({
  title: z.string().min(10, 'Mínimo 10 caracteres').max(500),
  description: z.string().optional(),
  templateId: z.string().min(1, 'Selecciona un documento patrón'),
  academicPeriod: z.string().min(1, 'Requerido'),
  deliveryNumber: z.coerce.number().min(1).max(10),
});
type FormData = z.infer<typeof schema>;

export default function NewSubmissionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [error, setError] = useState('');

  const programId = user?.studentProfile?.programId;

  const { data: templates } = useQuery({
    queryKey: ['templates', programId],
    queryFn: () => templatesApi.list(programId).then(r => r.data.data),
    enabled: !!programId,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { deliveryNumber: 1, academicPeriod: '2024-2' },
  });

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.type)) {
      setError('Solo se permiten archivos PDF o Word (.docx)');
      return;
    }
    if (f.size > 50 * 1024 * 1024) { setError('El archivo no puede superar 50MB'); return; }
    setFile(f);
    setError('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }, maxFiles: 1 });

  const onSubmit = async (data: FormData) => {
    if (!file) { setError('Debes seleccionar un archivo'); return; }
    setUploading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(data).forEach(([k, v]) => fd.append(k, String(v)));

      const interval = setInterval(() => setProgress(p => Math.min(p + 10, 85)), 400);
      const res = await submissionsApi.upload(fd);
      clearInterval(interval);
      setProgress(100);
      setSuccess(true);
      setSubmissionId(res.data.data.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Avance enviado!</h2>
        <p className="text-gray-500 mb-3">Tu documento fue recibido correctamente y está pendiente de revisión por tu asesor.</p>
        <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 rounded-lg p-4 mb-8">
          <FileText size={20} />
          <span className="text-sm font-medium">Recibirás una notificación cuando sea evaluado.</span>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push(`/submissions/${submissionId}`)} className="btn-primary">Ver mi avance</button>
          <button onClick={() => router.push('/submissions')} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Ver todos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="section-title">Subir Nuevo Avance</h1>
        <p className="text-gray-500 text-sm">Tu documento será revisado por tu asesor y recibirás retroalimentación.</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={24} className="text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{bytesToMB(file.size)}</p>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="ml-4 p-1 hover:bg-red-100 rounded text-red-500">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-700">Arrastra tu archivo aquí o haz clic para seleccionar</p>
              <p className="text-sm text-gray-400 mt-1">PDF o Word (.docx) · Máximo 50 MB</p>
            </div>
          )}
        </div>

        {/* Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título del avance *</label>
          <input {...register('title')} className="input-field" placeholder="Ej: Capítulo 1 - Marco Teórico y Estado del Arte" />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
          <textarea {...register('description')} rows={3} className="input-field resize-none" placeholder="Descripción breve del contenido del avance..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Documento Patrón *</label>
            <select {...register('templateId')} className="input-field">
              <option value="">Seleccionar...</option>
              {(templates || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
              ))}
            </select>
            {errors.templateId && <p className="text-red-500 text-xs mt-1">{errors.templateId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período académico *</label>
            <input {...register('academicPeriod')} className="input-field" placeholder="2024-2" />
            {errors.academicPeriod && <p className="text-red-500 text-xs mt-1">{errors.academicPeriod.message}</p>}
          </div>
        </div>

        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">N° de entrega</label>
          <input {...register('deliveryNumber')} type="number" min={1} max={10} className="input-field" />
        </div>

        {uploading && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{progress < 100 ? 'Subiendo documento...' : 'Completado'}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={uploading || !file} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Subiendo...</> : <><Upload size={16} /> Subir avance</>}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
