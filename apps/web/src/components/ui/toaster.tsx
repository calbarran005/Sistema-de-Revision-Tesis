'use client';
import { useToast } from './use-toast';
import { X } from 'lucide-react';

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border text-sm ${t.variant === 'destructive' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-800'}`}>
          <div className="flex-1"><p className="font-medium">{t.title}</p>{t.description && <p className="text-xs opacity-70 mt-0.5">{t.description}</p>}</div>
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
