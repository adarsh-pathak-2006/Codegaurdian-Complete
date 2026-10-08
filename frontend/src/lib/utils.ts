import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'HIGH': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'LOW': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'SCANNING':
    case 'PREPARING':
    case 'NORMALIZING':
    case 'SCORING': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'QUEUED': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'FAILED': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'CANCELLED': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function findingStatusColor(status: string): string {
  switch (status) {
    case 'OPEN': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'FIX_IN_PROGRESS': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'FIXED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'FALSE_POSITIVE': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    case 'ACCEPTED_RISK': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function riskScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 25) return 'text-orange-400';
  return 'text-red-400';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function isGithubUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[\w\-]+\/[\w\-.]+(\.git)?/.test(url.trim());
}
