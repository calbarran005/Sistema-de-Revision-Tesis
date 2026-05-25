'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { BookOpen, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

const schema = z.object({ email: z.string().email('Email inválido') });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: any) => {
    await authApi.forgotPassword(data.email);
    setSent(true);
  };

  if (sent) return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Email enviado</h2>
        <p className="text-gray-500 text-sm mb-6">Si el email existe, recibirás las instrucciones en tu bandeja de entrada.</p>
        <a href="/login" className="btn-primary inline-block">Volver al login</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <BookOpen className="w-8 h-8 text-[#1e3a5f]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Recuperar contraseña</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email institucional</label>
              <input {...register('email')} type="email" className="input-field" placeholder="usuario@universidad.edu.co" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Enviar instrucciones
            </button>
          </form>
          <a href="/login" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-4 justify-center">
            <ArrowLeft size={14} /> Volver al login
          </a>
        </div>
      </div>
    </div>
  );
}
