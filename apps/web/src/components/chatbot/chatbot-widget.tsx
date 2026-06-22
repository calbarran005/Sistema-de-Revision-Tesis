'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Bot, Loader2 } from 'lucide-react';
import { chatbotApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '¿Cuántas tesis se han revisado?',
  '¿Cuántos avances están pendientes?',
  '¿Cuál es la tasa de aprobación?',
  '¿Para qué sirve el sistema?',
];

const WELCOME =
  '¡Hola! 👋 Soy SisBot, el asistente del sistema SisTesis. Puedes escribirme o hablarme y te responderé sobre las tesis, revisiones, estadísticas y el funcionamiento del sistema.';

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-scroll al final
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  // Verificar soporte de grabación de micrófono (funciona en Brave, Firefox, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMicSupported(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Cargar las voces disponibles para la síntesis (se cargan de forma asíncrona)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  // Respaldo: voz nativa del navegador (no funciona en Brave/Linux sin voces instaladas)
  const speakBrowser = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = voicesRef.current.length ? voicesRef.current : synth.getVoices();
    const esVoice =
      voices.find((v) => v.lang?.toLowerCase() === 'es-pe') ||
      voices.find((v) => v.lang?.toLowerCase().startsWith('es'));
    if (esVoice) utter.voice = esVoice;
    utter.lang = esVoice?.lang || 'es-ES';
    synth.speak(utter);
    setTimeout(() => { if (synth.paused) synth.resume(); }, 120);
  };

  // Lee la respuesta en voz alta usando el TTS del backend (OpenAI), con respaldo al navegador.
  const speak = async (text: string) => {
    if (!speakEnabled) return;
    try {
      const res = await chatbotApi.tts(text);
      const url = URL.createObjectURL(res.data as Blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // Si el TTS del backend falla, intentar con la voz del navegador
      speakBrowser(text);
    }
  };

  // Graba el micrófono y, al detener, transcribe con Whisper (backend) hacia el input.
  const toggleListening = async () => {
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const res = await chatbotApi.transcribe(blob);
          const text: string = res.data?.text ?? res.data?.data?.text ?? '';
          if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch {
          /* error de transcripción: el usuario puede escribir manualmente */
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleSpeak = () => {
    const willEnable = !speakEnabled;
    setSpeakEnabled(willEnable);
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    if (!willEnable && audioRef.current) audioRef.current.pause();
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const newMessages: Msg[] = [...messages, { role: 'user', content: message }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Enviamos el historial reciente (sin el mensaje de bienvenida)
      const history = newMessages.filter((m) => m.content !== WELCOME).slice(-8);
      const res = await chatbotApi.ask(message, history);
      const answer: string = res.data?.answer ?? res.data?.data?.answer ?? 'No obtuve respuesta.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      speak(answer);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Ocurrió un error al procesar tu pregunta. Intenta nuevamente.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#1e3a5f] text-white shadow-lg hover:bg-[#16304d] transition-all hover:scale-105"
        >
          <MessageCircle size={26} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(92vw,380px)] h-[min(80vh,560px)] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1e3a5f] text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <p className="font-semibold leading-tight text-sm">SisBot</p>
                <p className="text-[11px] text-white/70 leading-tight">Asistente del sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleSpeak}
                title={speakEnabled ? 'Desactivar lectura por voz' : 'Activar lectura por voz'}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                {speakEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Cerrar"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed',
                    m.role === 'user'
                      ? 'bg-[#1e3a5f] text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 size={15} className="animate-spin" /> Pensando…
                </div>
              </div>
            )}

            {/* Sugerencias (solo al inicio) */}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-2.5 bg-white">
            {listening && (
              <p className="text-[11px] text-red-500 px-2 pb-1 flex items-center gap-1 animate-pulse">
                <Mic size={12} /> Grabando… toca de nuevo para enviar
              </p>
            )}
            {transcribing && (
              <p className="text-[11px] text-gray-500 px-2 pb-1 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Transcribiendo audio…
              </p>
            )}
            <div className="flex items-end gap-1.5">
              {micSupported && (
                <button
                  onClick={toggleListening}
                  disabled={transcribing}
                  title={listening ? 'Detener y transcribir' : 'Hablar'}
                  className={cn(
                    'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50',
                    listening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Escribe tu pregunta…"
                className="flex-1 resize-none max-h-24 px-3 py-2 text-sm rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                title="Enviar"
                className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center hover:bg-[#16304d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
