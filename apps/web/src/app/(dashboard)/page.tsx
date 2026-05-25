'use client';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, Clock, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { getStatusConfig, getScoreColor, formatRelative } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#16a34a', REJECTED: '#dc2626', PENDING_REVIEW: '#d97706',
  ANALYZING: '#7c3aed', IN_REVIEW: '#0891b2', SUBMITTED: '#2563eb', DRAFT: '#6b7280',
};

function KpiCard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="p-3 rounded-xl" style={{ background: color + '20' }}>
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => dashboardApi.getKPIs().then(r => r.data.data),
    refetchInterval: 30000,
  });

  const { data: byMonth } = useQuery({
    queryKey: ['byMonth'],
    queryFn: () => dashboardApi.getByMonth().then(r => r.data.data),
  });

  const { data: statusDist } = useQuery({
    queryKey: ['statusDist'],
    queryFn: () => dashboardApi.getStatusDist().then(r => r.data.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => dashboardApi.getRecentActivity().then(r => r.data.data),
  });

  if (kpisLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse"><div className="h-16 bg-gray-100 rounded" /></div>
          ))}
        </div>
      </div>
    );
  }

  const pieData = (statusDist || []).map((d: any) => ({
    name: getStatusConfig(d.status).label,
    value: d.count,
    color: STATUS_COLORS[d.status] || '#6b7280',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Panel de Control</h1>
        <p className="text-gray-500 text-sm">Bienvenido, {user?.firstName}. Resumen general del sistema.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Avances" value={kpis?.totalSubmissions || 0} icon={FileText} color="#2563eb" sub="Todos los períodos" />
        <KpiCard title="En Proceso" value={kpis?.pendingReview || 0} icon={Clock} color="#d97706" sub="Sin resolución final" />
        <KpiCard title="Aprobados" value={kpis?.approved || 0} icon={CheckCircle} color="#16a34a" sub={`${kpis?.approvalRate || 0}% tasa de aprobación`} />
        <KpiCard title="Promedio IA" value={`${kpis?.avgAiScore || 0}%`} icon={TrendingUp} color="#7c3aed" sub="Cumplimiento promedio" />
      </div>

      {/* Alertas bajo cumplimiento */}
      {kpis?.lowComplianceSubmissions?.length > 0 && (
        <div className="card p-4 border-l-4 border-l-orange-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-orange-500" />
            <span className="font-semibold text-orange-700">Avances con bajo cumplimiento IA (&lt;60%)</span>
          </div>
          <div className="space-y-2">
            {kpis.lowComplianceSubmissions.map((s: any) => (
              <a href={`/submissions/${s.id}`} key={s.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.student?.user?.firstName} {s.student?.user?.lastName}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: getScoreColor(s.aiAnalysis?.complianceScore || 0) }}>
                  {s.aiAnalysis?.complianceScore || 0}%
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avances por mes */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Avances por Mes</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byMonth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="approved" name="Aprobados" fill="#16a34a" radius={[4,4,0,0]} />
              <Bar dataKey="pending" name="Pendientes" fill="#d97706" radius={[4,4,0,0]} />
              <Bar dataKey="rejected" name="Rechazados" fill="#dc2626" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de estados */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Estados</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-16">Sin datos aún</p>}
        </div>
      </div>

      {/* Actividad reciente */}
      {activity?.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {activity.slice(0, 6).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                  {log.user?.firstName?.[0]}{log.user?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900">{log.description}</p>
                  <p className="text-gray-400 text-xs">{formatRelative(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
