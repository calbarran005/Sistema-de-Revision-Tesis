'use client';
import { useState, useCallback } from 'react';

interface Toast { id: string; title: string; description?: string; variant?: 'default' | 'destructive'; }
let toasts: Toast[] = [];
let listeners: (() => void)[] = [];

function notify() { listeners.forEach(l => l()); }

export function toast(t: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...t, id }];
  notify();
  setTimeout(() => { toasts = toasts.filter(x => x.id !== id); notify(); }, 4000);
}

export function useToast() {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(n => n + 1), []);
  if (!listeners.includes(rerender)) listeners.push(rerender);
  const dismiss = (id: string) => { toasts = toasts.filter(x => x.id !== id); notify(); };
  return { toasts, dismiss };
}
