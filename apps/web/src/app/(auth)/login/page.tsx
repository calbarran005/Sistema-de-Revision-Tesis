'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { BookOpen, Loader2, Eye, EyeOff } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await authApi.login(data);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#1e40af] to-[#2563eb] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <BookOpen className="w-8 h-8 text-[#1e3a5f]" />
          </div>
          <h1 className="text-3xl font-bold text-white">SisTesis</h1>
          <p className="text-blue-200 mt-1 text-sm">Sistema de Gestión de Avances de Tesis</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Bienvenido</h2>
          <p className="text-gray-500 text-sm mb-6">Ingresa tus credenciales para continuar</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email institucional</label>
              <input
                {...register('email')}
                type="email"
                placeholder="usuario@universidad.edu.co"
                className="input-field"
                autoComplete="email"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">¿Olvidaste tu contraseña?</a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Ingresando...</> : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              ¿No tienes cuenta? Contacta al administrador del sistema.
            </p>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 bg-white/10 backdrop-blur rounded-xl p-4 text-white text-xs">
          <p className="font-semibold mb-2">Credenciales de prueba:</p>
          <div className="space-y-1 text-blue-100">
            <p>👤 Admin: admin@universidad.edu.co / Admin123!</p>
            <p>📚 Asesor: asesor@universidad.edu.co / Asesor123!</p>
            <p>🎓 Estudiante: estudiante@universidad.edu.co / Student123!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
