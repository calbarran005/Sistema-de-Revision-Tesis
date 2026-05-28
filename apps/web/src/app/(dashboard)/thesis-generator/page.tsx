'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollText, Loader2, Download, FileText, ChevronRight, RefreshCw, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';
import { thesisGeneratorApi } from '@/lib/api';
import { generateDocxBlob } from './utils/docx-generator';

// ─── Constants ────────────────────────────────────────────────────────────────
const RESEARCH_LINES = [
  'Gestión de Gobierno y Servicios de TIC',
  'Gestión de Proyectos de TIC',
  'Gestión de Desarrollo de Software',
  'Gestión de Infraestructura y Comunicaciones',
  'Gestión de la Seguridad de la Información',
];
const CITIES = ['Trujillo', 'Guadalupe', 'Otra ciudad de sede descentralizada'];
const DEGREES = ['Dr.', 'Mg.', 'Ing.', 'Lic.'];
const CURRENT_YEAR = new Date().getFullYear();

// ─── Schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(10, 'Mínimo 10 caracteres').max(200, 'Máximo 200 caracteres'),
  author1: z.string().min(5, 'Ingresa el nombre del primer autor'),
  author2: z.string().optional(),
  advisor: z.string().min(5, 'Ingresa el nombre del asesor'),
  advisorDegree: z.string().min(1),
  researchLine: z.string().min(1, 'Selecciona una línea de investigación'),
  city: z.string().min(1, 'Selecciona una ciudad'),
  year: z.coerce.number().min(2020).max(2035),
  juryPresident: z.string().min(5, 'Ingresa el nombre del presidente'),
  juryPresidentDegree: z.string().min(1),
  jurySecretary: z.string().min(5, 'Ingresa el nombre del secretario'),
  jurySecretaryDegree: z.string().min(1),
  juryVocal: z.string().min(5, 'Ingresa el nombre del vocal'),
  juryVocalDegree: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ThesisContent {
  introduction: string;
  references: string[];
  problemTree: { centralProblem: string; causes: string[]; effects: string[] };
  objectiveTree: { mainObjective: string; means: string[]; ends: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function SelectDegree({ name, register }: { name: any; register: any }) {
  return (
    <select {...register(name)} className="input-field w-24">
      {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ThesisGeneratorPage() {
  const [step, setStep] = useState<'form' | 'generating' | 'preview'>('form');
  const [generatedContent, setGeneratedContent] = useState<ThesisContent | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'intro' | 'refs' | 'trees' | 'raw'>('intro');

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { advisorDegree: 'Dr.', juryPresidentDegree: 'Dr.', jurySecretaryDegree: 'Dr.', juryVocalDegree: 'Dr.', year: CURRENT_YEAR, city: 'Trujillo', researchLine: '' },
  });

  // Build payload from form values
  function buildPayload(values: FormValues) {
    const authors = [values.author1, values.author2].filter(Boolean) as string[];
    return {
      title: values.title,
      authors,
      advisor: values.advisor,
      advisorDegree: values.advisorDegree,
      researchLine: values.researchLine,
      city: values.city,
      year: Number(values.year),
      juryPresident: values.juryPresident,
      juryPresidentDegree: values.juryPresidentDegree,
      jurySecretary: values.jurySecretary,
      jurySecretaryDegree: values.jurySecretaryDegree,
      juryVocal: values.juryVocal,
      juryVocalDegree: values.juryVocalDegree,
    };
  }

  const onSubmit = async (values: FormValues) => {
    setGenerationError('');
    setStep('generating');
    try {
      const payload = buildPayload(values);
      const res = await thesisGeneratorApi.generateContent(payload);
      // El interceptor de NestJS envuelve en { success, data }, por eso accedemos a res.data.data
      const raw = res.data?.data ?? res.data ?? {};
      const content: ThesisContent = {
        introduction: raw.introduction || raw.Introduction || '',
        references: Array.isArray(raw.references) ? raw.references : [],
        problemTree: raw.problemTree || raw.problem_tree || { centralProblem: '', causes: [], effects: [] },
        objectiveTree: raw.objectiveTree || raw.objective_tree || { mainObjective: '', means: [], ends: [] },
      };
      if (!content.introduction && !content.references.length) {
        throw new Error('La IA no generó contenido. Intente nuevamente.');
      }
      setGeneratedContent(content);
      setStep('preview');
    } catch (err: any) {
      setGenerationError(err.response?.data?.message || 'Error al generar el contenido. Intente nuevamente.');
      setStep('form');
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedContent) return;
    setPdfLoading(true);
    try {
      const formData = buildPayload(getValues());
      const res = await thesisGeneratorApi.exportPdf({ formData, content: generatedContent });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `proyecto-de-tesis-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al generar el PDF. Intente nuevamente.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedContent) return;
    setDocxLoading(true);
    try {
      const formData = buildPayload(getValues());
      const blob = await generateDocxBlob(formData, generatedContent);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `proyecto-de-tesis-${Date.now()}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al generar el Word. Intente nuevamente.');
    } finally {
      setDocxLoading(false);
    }
  };

  // ─── GENERATING SCREEN ────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Loader2 size={36} className="text-blue-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Generando Proyecto de Tesis</h2>
        <p className="text-gray-500 text-sm">
          La IA está redactando la introducción completa, referencias bibliográficas APA V7
          y los árboles de problemas y objetivos. Este proceso puede tardar entre 30 y 60 segundos.
        </p>
        <div className="space-y-2 text-left bg-blue-50 border border-blue-100 rounded-xl p-4">
          {[
            'Analizando el tema de investigación...',
            'Redactando realidad problemática y antecedentes...',
            'Generando marco teórico y 3 metodologías...',
            'Formulando hipótesis, objetivos y limitaciones...',
            'Compilando 30+ referencias APA V7...',
            'Construyendo árbol de problemas y objetivos...',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
              <div className="analyzing-dot w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" style={{ animationDelay: `${i * 0.3}s` }} />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── PREVIEW SCREEN ────────────────────────────────────────────────────────
  if (step === 'preview' && generatedContent) {
    const fv = getValues();
    const authors = [fv.author1, fv.author2].filter(Boolean) as string[];
    const pt = generatedContent.problemTree;
    const ot = generatedContent.objectiveTree;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="section-title flex items-center gap-2"><ScrollText size={22} /> Proyecto de Tesis Generado</h1>
            <p className="text-gray-500 text-sm mt-1 max-w-2xl">{fv.title}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStep('form')}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={15} /> Regenerar
            </button>
            <button
              onClick={handleDownloadDocx}
              disabled={docxLoading}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-60"
            >
              {docxLoading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Descargar Word
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-4 py-2 btn-primary text-sm disabled:opacity-60"
            >
              {pdfLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Descargar PDF
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Palabras (Intro)', value: (generatedContent.introduction || '').split(' ').filter(Boolean).length.toLocaleString() },
            { label: 'Referencias', value: (generatedContent.references || []).length },
            { label: 'Autores', value: authors.length },
            { label: 'Año', value: fv.year },
          ].map(({ label, value }) => (
            <div key={label} className="card p-3 text-center">
              <div className="text-lg font-bold text-[#1e3a5f]">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Cover preview card */}
        <div className="card p-6 border-2 border-dashed border-gray-200">
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Vista previa – Carátula</p>
            <p className="font-bold text-[#1e3a5f] text-sm uppercase">Universidad Nacional de Trujillo</p>
            <p className="text-sm font-semibold uppercase">Facultad de Ingeniería</p>
            <p className="text-sm uppercase">Programa de Estudios de Ingeniería de Sistemas</p>
            <div className="my-3 w-12 h-12 mx-auto border-2 border-[#1e3a5f] rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-[#1e3a5f]">UNT</span>
            </div>
            <p className="text-xs border-t border-b border-gray-300 py-1 font-bold uppercase">Informe de Proyecto de Tesis</p>
            <p className="text-sm font-bold mt-2 max-w-sm mx-auto">{fv.title}</p>
            <div className="mt-2 text-xs text-gray-600">
              {authors.map((a) => <p key={a}>Bach. {a}</p>)}
            </div>
            <p className="text-xs text-gray-600 mt-1">Asesor: {fv.advisorDegree} {fv.advisor}</p>
            <p className="text-xs text-gray-500 mt-1">{fv.researchLine}</p>
            <p className="text-xs text-gray-500 mt-2">{fv.city} – Perú · {fv.year}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {([
              { key: 'intro', label: 'Cap. I Introducción' },
              { key: 'refs', label: `Referencias (${(generatedContent.references || []).length})` },
              { key: 'trees', label: 'Árboles' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === key ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6 max-h-[520px] overflow-y-auto">
            {/* INTRODUCCIÓN */}
            {activeTab === 'intro' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} />
                  Redactada en prosa continua sin subtítulos · Incluye realidad problemática, antecedentes, marco teórico, 3 metodologías, justificación, hipótesis, objetivos y limitaciones
                </div>
                <div className="text-sm text-gray-800 leading-relaxed text-justify whitespace-pre-wrap font-[Arial_Narrow,Arial,sans-serif]">
                  {generatedContent.introduction || 'Sin contenido generado.'}
                </div>
              </div>
            )}

            {/* REFERENCIAS */}
            {activeTab === 'refs' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                  <AlertCircle size={14} />
                  {(generatedContent.references || []).length} referencias · Formato APA V7 · Ordenadas alfabéticamente
                </div>
                {(generatedContent.references || []).map((ref, i) => (
                  <p key={i} className="text-sm text-gray-700 pl-8 -indent-8 leading-relaxed">{ref}</p>
                ))}
              </div>
            )}

            {/* ÁRBOLES */}
            {activeTab === 'trees' && (
              <div className="space-y-8">
                {/* Árbol de Problemas */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Árbol de Problemas</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase mb-2">Efectos</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(pt?.effects || []).map((e, i) => (
                          <div key={i} className="text-xs border border-red-200 bg-red-50 rounded p-2 text-center">{e}</div>
                        ))}
                      </div>
                    </div>
                    <div className="border-2 border-orange-400 bg-orange-50 rounded-lg p-3 text-center text-sm font-medium">
                      {pt?.centralProblem}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-orange-600 uppercase mb-2">Causas</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(pt?.causes || []).map((c, i) => (
                          <div key={i} className="text-xs border border-orange-200 bg-orange-50 rounded p-2 text-center">{c}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Árbol de Objetivos */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Árbol de Objetivos</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-green-600 uppercase mb-2">Fines</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(ot?.ends || []).map((e, i) => (
                          <div key={i} className="text-xs border border-green-200 bg-green-50 rounded p-2 text-center">{e}</div>
                        ))}
                      </div>
                    </div>
                    <div className="border-2 border-blue-500 bg-blue-50 rounded-lg p-3 text-center text-sm font-medium">
                      {ot?.mainObjective}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Medios</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(ot?.means || []).map((m, i) => (
                          <div key={i} className="text-xs border border-blue-200 bg-blue-50 rounded p-2 text-center">{m}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Format reminder */}
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-800 font-medium mb-1">Formato del documento exportado (según esquema UNT):</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-amber-700">
            <span>Fuente: Arial Narrow 12pt</span>
            <span>Interlineado: 1.5 líneas</span>
            <span>Márgenes: 2.5cm / 3cm (izq.)</span>
            <span>Norma: APA V7</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── FORM SCREEN ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="section-title flex items-center gap-2"><ScrollText size={22} /> Generador de Proyecto de Tesis</h1>
        <p className="text-gray-500 text-sm mt-1">
          Completa los datos y el sistema generará automáticamente el Informe de Proyecto de Tesis
          siguiendo el esquema oficial de la Universidad Nacional de Trujillo.
        </p>
      </div>

      {generationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {generationError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* SECCIÓN 1: DATOS PRINCIPALES */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[#1e3a5f] text-sm uppercase tracking-wide border-b pb-2">
            1. Datos Principales
          </h2>

          <Field error={errors.title?.message}>
            <Label text="Título de la Tesis" required />
            <textarea
              {...register('title')}
              rows={3}
              className="input-field resize-none"
              placeholder="Ej: Sistema de gestión de inventarios basado en tecnología RFID para mejorar el control de activos en la Municipalidad Provincial de Trujillo"
            />
            <p className="text-xs text-gray-400 mt-0.5">Máximo 20 palabras, claro y conciso, sin exceder 200 caracteres.</p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field error={errors.author1?.message}>
              <Label text="Autor 1 (Apellidos y Nombres)" required />
              <input {...register('author1')} className="input-field" placeholder="Ej: García López, Juan Carlos" />
            </Field>
            <div>
              <Label text="Autor 2 (opcional)" />
              <input {...register('author2')} className="input-field" placeholder="Ej: Rodríguez Sánchez, María" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field error={errors.researchLine?.message}>
              <Label text="Línea de Investigación" required />
              <select {...register('researchLine')} className="input-field">
                <option value="">Seleccionar...</option>
                {RESEARCH_LINES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field error={errors.city?.message}>
                <Label text="Ciudad" required />
                <select {...register('city')} className="input-field">
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field error={errors.year?.message}>
                <Label text="Año" required />
                <input {...register('year')} type="number" className="input-field" min={2020} max={2035} />
              </Field>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: ASESOR */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[#1e3a5f] text-sm uppercase tracking-wide border-b pb-2">
            2. Asesor
          </h2>
          <Field error={errors.advisor?.message}>
            <Label text="Apellidos y Nombres del Asesor" required />
            <div className="flex gap-2">
              <SelectDegree name="advisorDegree" register={register} />
              <input {...register('advisor')} className="input-field flex-1" placeholder="Ej: Mendoza Torres, Carlos Alberto" />
            </div>
          </Field>
        </div>

        {/* SECCIÓN 3: JURADO */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[#1e3a5f] text-sm uppercase tracking-wide border-b pb-2">
            3. Jurado Dictaminador
          </h2>
          <p className="text-xs text-gray-500">El Vocal es a su vez el Asesor de la Tesis. Los nombres deben coincidir con el DNI.</p>

          {[
            { role: 'Presidente (Docente General/Especialista)', nameKey: 'juryPresident', degreeKey: 'juryPresidentDegree', errKey: errors.juryPresident },
            { role: 'Secretario (Docente Metodólogo)', nameKey: 'jurySecretary', degreeKey: 'jurySecretaryDegree', errKey: errors.jurySecretary },
            { role: 'Vocal / Asesor (Docente Especialista)', nameKey: 'juryVocal', degreeKey: 'juryVocalDegree', errKey: errors.juryVocal },
          ].map(({ role, nameKey, degreeKey, errKey }) => (
            <Field key={nameKey} error={(errKey as any)?.message}>
              <Label text={role} required />
              <div className="flex gap-2">
                <SelectDegree name={degreeKey as any} register={register} />
                <input {...register(nameKey as any)} className="input-field flex-1" placeholder="Apellidos y Nombres completos" />
              </div>
            </Field>
          ))}
        </div>

        {/* INFO BOX */}
        <div className="card p-4 bg-blue-50 border-blue-100 space-y-2">
          <p className="text-sm font-medium text-blue-800">¿Qué genera el sistema?</p>
          <ul className="text-xs text-blue-700 space-y-1">
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> Carátula con logotipo institucional y todos los datos</li>
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> Jurado dictaminador e índice general</li>
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> Capítulo I completo: prosa continua de 2000+ palabras con realidad problemática, antecedentes, marco teórico (3 metodologías), justificación, hipótesis, objetivos y limitaciones</li>
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> 30+ referencias bibliográficas en APA V7 (80% inglés, 80% últimos 5 años, 80% indexadas)</li>
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> Árbol de problemas y árbol de objetivos</li>
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> Declaración jurada firmada</li>
            <li className="flex items-center gap-1.5"><ChevronRight size={12} /> Exportación en PDF (Arial Narrow 12pt, márgenes APA) y Word (.docx)</li>
          </ul>
        </div>

        {/* SUBMIT */}
        <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
          <ScrollText size={18} /> Generar Proyecto de Tesis Completo
        </button>
      </form>
    </div>
  );
}
