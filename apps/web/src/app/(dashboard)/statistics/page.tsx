'use client';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, Legend,
} from 'recharts';
import { getScoreColor } from '@/lib/utils';

const COLORS = ['#1e3a5f', '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

export default function StatisticsPage() {
  const { data: byMonth } = useQuery({ queryKey: ['byMonth'], queryFn: () => dashboardApi.getByMonth().then(r => r.data.data) });
  const { data: statusDist } = useQuery({ queryKey: ['statusDist'], queryFn: () => dashboardApi.getStatusDist().then(r => r.data.data) });
  const { data: scoreDist } = useQuery({ queryKey: ['scoreDist'], queryFn: () => dashboardApi.getScoreDist().then(r => r.data.data) });
  const { data: workload } = useQuery({ queryKey: ['workload'], queryFn: () => dashboardApi.getAdvisorWorkload().then(r => r.data.data) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Estadísticas y Análisis</h1>
        <p className="text-gray-500 text-sm">Visualización de métricas del programa académico</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avances por mes */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Avances por Mes (Año actual)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byMonth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Total" fill="#1e3a5f" radius={[4,4,0,0]} />
              <Bar dataKey="approved" name="Aprobados" fill="#16a34a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de estados */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución por Estado</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusDist || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label={({ status, count }) => `${status}: ${count}`}>
                {(statusDist || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de puntajes IA */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de Puntajes IA</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scoreDist || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Avances" radius={[4,4,0,0]}>
                {(scoreDist || []).map((entry: any, i: number) => {
                  const mid = (parseInt(entry.range.split('-')[0]) + parseInt(entry.range.split('-')[1])) / 2;
                  return <Cell key={i} fill={getScoreColor(mid)} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Carga de asesores */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Carga de Trabajo por Asesor</h3>
          {(workload || []).length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">Sin datos de asesores</div>
          ) : (
            <div className="space-y-3">
              {(workload || []).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm text-gray-700">{a.name}</div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-[#1e3a5f] rounded-full"
                        style={{ width: `${Math.min((a.totalStudents / 10) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 w-28 text-right">{a.totalStudents} estudiantes · {a.pendingReviews} pendientes</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
