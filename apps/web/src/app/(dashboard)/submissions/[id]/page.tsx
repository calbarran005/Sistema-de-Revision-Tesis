'use client';
import { use, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionsApi, aiApi, reviewsApi, reportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getStatusConfig, getSeverityConfig, getScoreColor, formatDate } from '@/lib/utils';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';
import {
  Brain, FileText, Download, AlertTriangle, CheckCircle, Info,
  ChevronDown, ChevronUp, User, Loader2, CheckCheck, X as XIcon
} from 'lucide-react';

type Params = { id: string };

export default function SubmissionDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ai' | 'review' | 'structure'>('ai');
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [decision, setDecision] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => submissionsApi.get(id).then(r => r.data.data),
    refetchInterval: (d) => ['SUBMITTED', 'ANALYZING'].includes(d?.status) ? 3000 : false,
  });

  // Cargar URL presignada para la preview del documento
  useEffect(() => {
    if (!id) return;
    submissionsApi.getDownloadUrl(id)
      .then(r => setPreviewUrl(r.data.data?.url || null))
      .catch(() => setPreviewUrl(null));
  }, [id]);

  const startReview = useMutation({
    mutationFn: () => reviewsApi.start(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submission', id] });
      qc.invalidateQueries({ queryKey: ['submissions'] });
    },
  });

  const startAiAnalysis = useMutation({
    mutationFn: () => aiApi.startAnalysis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submission', id] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => reviewsApi.finalize(submission?.humanReview?.id, {
      decision,
      note: decisionNote,
      notificationEmail: notificationEmail || undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submission', id] });
      qc.invalidateQueries({ queryKey: ['submissions'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      qc.invalidateQueries({ queryKey: ['statusDist'] });
    },
  });

  const acceptFinding = useMutation({
    mutationFn: (findingId: string) => aiApi.acceptFinding(findingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission', id] }),
  });

  const downloadReport = async () => {
    const res = await reportsApi.downloadIndividual(id);
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `acta-${id}.pdf`; a.click();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;
  }

  if (!submission) return <div className="text-center py-16 text-gray-400">Avance no encontrado</div>;

  const ai = submission.aiAnalysis;
  const review = submission.humanReview;
  const statusCfg = getStatusConfig(submission.status);
  const canReview = ['ADVISOR', 'COORDINATOR', 'ADMIN'].includes(user?.role || '');

  const radarData = ai ? [
    { dimension: 'Estructura', score: ai.structureScore || 0 },
    { dimension: 'Contenido', score: ai.contentScore || 0 },
    { dimension: 'Forma', score: ai.formScore || 0 },
    { dimension: 'Originalidad', score: ai.originalityScore || 0 },
  ] : [];

  const findings = ai?.findings || [];
  const criticalCount = findings.filter((f: any) => f.severity === 'CRITICAL').length;
  
  const extractedText = submission.extractedText as Record<string, string> || {};
  const sections = Object.entries(extractedText);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{submission.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{submission.student?.user?.firstName} {submission.student?.user?.lastName}</span>
            <span>·</span>
            <span>v{submission.versionNumber}</span>
            <span>·</span>
            <span>{formatDate(submission.createdAt)}</span>
            <span className="badge-status" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canReview && !['ANALYZING', 'PROCESSING'].includes(submission.status) && (!ai || ai.status === 'PENDING' || ai.status === 'FAILED') && (
            <button
              onClick={() => startAiAnalysis.mutate()}
              disabled={startAiAnalysis.isPending}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-60"
            >
              {startAiAnalysis.isPending ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              Evaluar con IA
            </button>
          )}
          {canReview && !review && !['ANALYZING', 'SUBMITTED'].includes(submission.status) && (
            <button onClick={() => startReview.mutate()} disabled={startReview.isPending}
              className="btn-primary flex items-center gap-2 text-sm">
              {startReview.isPending ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />}
              Iniciar revisión
            </button>
          )}
          <button onClick={downloadReport} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Download size={14} /> Descargar acta
          </button>
        </div>
      </div>

      {/* Analyzing state */}
      {submission.status === 'ANALYZING' && (
        <div className="card p-6 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="analyzing-dot w-3 h-3 rounded-full bg-purple-500" style={{ animationDelay: `${i*0.3}s` }} />)}
            </div>
            <div>
              <p className="font-semibold text-purple-800">Análisis IA en proceso...</p>
              <p className="text-sm text-purple-600">El sistema está evaluando tu documento. Esto puede tomar hasta 30 segundos.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Document preview - left */}
        <div className="lg:col-span-3 card overflow-hidden" style={{ height: '75vh' }}>
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText size={15} className="text-blue-600" />
              {submission.fileName}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setActiveTab(activeTab === 'structure' ? 'ai' : 'structure')} className={`text-xs flex items-center gap-1 ${activeTab === 'structure' ? 'text-purple-600 font-bold' : 'text-gray-500'}`}>
                <Brain size={12} /> Desglose IA
              </button>
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  const res = await submissionsApi.getDownloadUrl(id);
                  window.open(res.data.data.url, '_blank');
                }}
                className="text-xs text-blue-600 hover:underline"
              >Abrir en nueva pestaña</a>
            </div>
          </div>
          <div className="relative h-full bg-gray-50 overflow-auto">
            {activeTab === 'structure' ? (
              <div className="p-6 space-y-8 bg-white h-full">
                <div className="border-b pb-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Brain className="text-purple-500" /> Desglose de Contenido Extraído
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Este es el texto tal como la IA lo ha identificado y segmentado.</p>
                </div>
                {sections.length > 0 ? (
                  <div className="space-y-10">
                    {sections.map(([name, text]) => (
                      <section key={name} className="relative pl-6 border-l-2 border-purple-100">
                        <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-purple-400" />
                        <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider mb-3">{name}</h3>
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">
                          {String(text)}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-400">
                    <Brain size={48} className="mx-auto mb-4 opacity-10" />
                    <p>No se ha podido extraer un desglose estructurado aún.</p>
                  </div>
                )}
              </div>
            ) : previewUrl ? (
              submission?.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-none"
                  title="Vista previa del documento"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 p-8">
                  <FileText size={56} className="text-blue-300" />
                  <div className="text-center">
                    <p className="font-medium text-gray-700">{submission?.fileName}</p>
                    <p className="text-sm text-gray-400 mt-1">Los archivos Word no se pueden previsualizar directamente.</p>
                  </div>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Download size={14} /> Descargar para ver
                  </a>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>Cargando previsualización...</p>
              </div>
            )}
          </div>
        </div>

        {/* Review panel - right */}
        <div className="lg:col-span-2 flex flex-col gap-4" style={{ height: '75vh', overflowY: 'auto' }}>
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Brain size={15} /> Evaluación IA
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'review' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <User size={15} /> Revisión Humana
            </button>
          </div>

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {!ai || ai.status === 'PENDING' ? (
                <div className="card p-6 text-center text-gray-400">
                  <Brain size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium text-gray-600">Evaluación IA no iniciada</p>
                  {canReview ? (
                    <p className="text-xs mt-1 text-gray-400">Usa el botón "Evaluar con IA" para iniciar la evaluación.</p>
                  ) : (
                    <p className="text-xs mt-1 text-gray-400">Tu asesor iniciará la evaluación cuando revise tu avance.</p>
                  )}
                </div>
              ) : ai.status === 'PROCESSING' ? (
                <div className="card p-6 text-center">
                  <Loader2 size={32} className="mx-auto mb-2 animate-spin text-purple-500" />
                  <p className="text-sm text-gray-600">Analizando documento...</p>
                </div>
              ) : (
                <>
                  {/* Scores summary */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-700">Cumplimiento Global</span>
                      <span className="text-2xl font-bold" style={{ color: getScoreColor(ai.complianceScore || 0) }}>{ai.complianceScore || 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mb-4">
                      <div className="h-full rounded-full transition-all" style={{ width: `${ai.complianceScore || 0}%`, background: getScoreColor(ai.complianceScore || 0) }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[['Estructura', ai.structureScore, '30%'], ['Contenido', ai.contentScore, '40%'], ['Forma', ai.formScore, '20%'], ['Originalidad', ai.originalityScore, '10%']].map(([label, score, weight]) => (
                        <div key={label as string} className="bg-gray-50 rounded p-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-500">{label}</span>
                            <span className="font-medium" style={{ color: getScoreColor(score as number || 0) }}>{score || 0}%</span>
                          </div>
                          <div className="h-1 bg-gray-200 rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${score || 0}%`, background: getScoreColor(score as number || 0) }} />
                          </div>
                          <span className="text-gray-400">{weight}</span>
                        </div>
                      ))}
                    </div>
                    {ai.finalGrade && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm text-gray-500">Nota IA</span>
                        <span className="text-lg font-bold text-[#1e3a5f]">{ai.finalGrade} / {ai.gradeScale}</span>
                      </div>
                    )}
                  </div>

                  {/* Radar chart */}
                  {radarData.length > 0 && (
                    <div className="card p-4">
                      <h4 className="text-sm font-semibold mb-2 text-gray-700">Perfil de Cumplimiento</h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Radar dataKey="score" stroke="#1e3a5f" fill="#1e3a5f" fillOpacity={0.3} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Executive summary */}
                  {ai.executiveSummary && (
                    <div className="card p-4 bg-blue-50 border-blue-100">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Resumen Ejecutivo IA</h4>
                      <p className="text-sm text-blue-700 leading-relaxed">{ai.executiveSummary}</p>
                    </div>
                  )}

                  {/* Findings */}
                  {findings.length > 0 && (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">Hallazgos ({findings.length})</h4>
                        {criticalCount > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{criticalCount} críticos</span>
                        )}
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {findings.map((f: any) => {
                          const sev = getSeverityConfig(f.severity);
                          const isExpanded = expandedFinding === f.id;
                          return (
                            <div key={f.id} className="border rounded-lg overflow-hidden" style={{ borderLeftColor: sev.border, borderLeftWidth: 3 }}>
                              <button
                                onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                                  <span className="text-xs text-gray-700 truncate">{f.title}</span>
                                </div>
                                {isExpanded ? <ChevronUp size={14} className="flex-shrink-0 text-gray-400" /> : <ChevronDown size={14} className="flex-shrink-0 text-gray-400" />}
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
                                  <p className="text-xs text-gray-700 mt-2">{f.description}</p>
                                  {f.sectionName && <p className="text-xs text-gray-400">Sección: {f.sectionName}</p>}
                                  <div className="bg-blue-50 rounded p-2">
                                    <p className="text-xs font-semibold text-blue-800 mb-1">{f.correctionTitle}</p>
                                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                                      {(f.correctionSteps || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                                    </ol>
                                  </div>
                                  {canReview && !f.isAcceptedByReviewer && (
                                    <button
                                      onClick={() => acceptFinding.mutate(f.id)}
                                      className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                                    >
                                      <CheckCheck size={12} /> Aceptar hallazgo
                                    </button>
                                  )}
                                  {f.isAcceptedByReviewer && (
                                    <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Aceptado por revisor</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Review Tab */}
          {activeTab === 'review' && (
            <div className="space-y-4">
              {!review ? (
                <div className="card p-6 text-center text-gray-400">
                  <User size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Sin revisión humana</p>
                  {canReview && (
                    <button onClick={() => startReview.mutate()} disabled={startReview.isPending}
                      className="mt-3 btn-primary text-sm flex items-center gap-2 mx-auto">
                      {startReview.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                      Iniciar revisión
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">Estado</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{review.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">Revisor: {review.reviewer?.firstName} {review.reviewer?.lastName}</p>
                  </div>

                  {review.generalComments && (
                    <div className="card p-4">
                      <h4 className="text-sm font-semibold mb-2">Comentarios del Revisor</h4>
                      <p className="text-sm text-gray-700">{review.generalComments}</p>
                    </div>
                  )}

                  {review.adjustedGrade && (
                    <div className="card p-4 bg-green-50 border-green-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-green-800">Nota ajustada</span>
                        <span className="text-2xl font-bold text-green-700">{review.adjustedGrade}</span>
                      </div>
                    </div>
                  )}

                  {/* Finalize form */}
                  {canReview && review.status !== 'FINALIZED' && (
                    <div className="card p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700">Decisión final</h4>
                      <select value={decision} onChange={(e) => setDecision(e.target.value)} className="input-field">
                        <option value="">Seleccionar decisión...</option>
                        <option value="APPROVED">✅ Aprobar</option>
                        <option value="OBSERVED">👁️ Observar (requiere correcciones)</option>
                        <option value="REJECTED">❌ Rechazar</option>
                      </select>
                      <textarea
                        value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Observación o justificación de la decisión..."
                        rows={3} className="input-field resize-none"
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500">Enviar resultados a (Email):</label>
                        <input
                          type="email"
                          value={notificationEmail}
                          onChange={(e) => setNotificationEmail(e.target.value)}
                          placeholder="correo@ejemplo.com (opcional)"
                          className="input-field text-sm"
                        />
                      </div>
                      <button
                        onClick={() => finalizeMutation.mutate()}
                        disabled={!decision || finalizeMutation.isPending}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {finalizeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                        Finalizar revisión
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
