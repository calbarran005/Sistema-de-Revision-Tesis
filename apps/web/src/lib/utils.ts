import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy') {
  return format(new Date(date), fmt, { locale: es });
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { locale: es, addSuffix: true });
}

export function formatScore(score: number | null | undefined, decimals = 1): string {
  if (score === null || score === undefined) return 'N/A';
  return score.toFixed(decimals);
}

export function getStatusConfig(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT:          { label: 'Borrador',          color: '#6b7280', bg: '#f3f4f6' },
    SUBMITTED:      { label: 'Enviado',            color: '#2563eb', bg: '#dbeafe' },
    ANALYZING:      { label: 'Analizando IA',      color: '#7c3aed', bg: '#ede9fe' },
    PENDING_REVIEW: { label: 'Pendiente Revisión', color: '#d97706', bg: '#fef3c7' },
    IN_REVIEW:      { label: 'En Revisión',        color: '#0891b2', bg: '#cffafe' },
    OBSERVED:       { label: 'Observado',          color: '#ea580c', bg: '#ffedd5' },
    APPROVED:       { label: 'Aprobado',           color: '#16a34a', bg: '#dcfce7' },
    REJECTED:       { label: 'Rechazado',          color: '#dc2626', bg: '#fee2e2' },
  };
  return map[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
}

export function getSeverityConfig(severity: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    CRITICAL:   { label: 'Crítico',    color: '#dc2626', bg: '#fee2e2', border: '#dc2626' },
    MAJOR:      { label: 'Mayor',      color: '#ea580c', bg: '#ffedd5', border: '#ea580c' },
    MINOR:      { label: 'Menor',      color: '#ca8a04', bg: '#fef9c3', border: '#ca8a04' },
    SUGGESTION: { label: 'Sugerencia', color: '#2563eb', bg: '#dbeafe', border: '#2563eb' },
  };
  return map[severity] || { label: severity, color: '#6b7280', bg: '#f3f4f6', border: '#6b7280' };
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str;
}

export function bytesToMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
