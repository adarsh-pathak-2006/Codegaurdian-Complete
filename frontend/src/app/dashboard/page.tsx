'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI, scansAPI, Project, Scan, PaginatedResponse } from '@/lib/api';
import { riskScoreColor, statusColor, severityColor, timeAgo, formatDate } from '@/lib/utils';
import {
  ShieldCheck, TrendingUp, AlertTriangle, Activity,
  ArrowRight, Plus, Clock, CheckCircle2, Zap
} from 'lucide-react';

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ElementType
}) {
  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color || 'bg-violet-500/15'}`}>
        <Icon className="w-5 h-5 text-violet-400" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs font-medium text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RiskGauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const angle = (s / 100) * 180;
  const color = s >= 80 ? '#22c55e' : s >= 50 ? '#eab308' : s >= 25 ? '#f97316' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full">
          <path d="M5,50 A45,45 0 0,1 95,50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M5,50 A45,45 0 0,1 95,50"
            fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.3} 141.3`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-2xl font-bold" style={{ color }}>{s}</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-1">Risk Score / 100</p>
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      projectsAPI.list(token),
      scansAPI.list(token),
    ]).then(([p, s]) => {
      setProjects((p as PaginatedResponse<Project>).results || []);
      setScans((s as PaginatedResponse<Scan>).results || []);
    }).finally(() => setLoading(false));
  }, [token]);

  const latestScans = scans.slice(0, 5);
  const completedScans = scans.filter(s => s.status === 'COMPLETED');
  const avgRisk = completedScans.length
    ? Math.round(completedScans.reduce((a, s) => a + (s.risk_score || 0), 0) / completedScans.length)
    : null;
  const totalCritical = scans.reduce((a, s) => a + s.critical_count, 0);
  const totalHigh = scans.reduce((a, s) => a + s.high_count, 0);

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 shimmer rounded-xl" />
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Security Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor your codebase security posture in real-time.</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" /> New Scan
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={projects.length} icon={ShieldCheck} />
        <StatCard label="Total Scans" value={scans.length} sub={`${completedScans.length} completed`} icon={Activity} />
        <StatCard label="Critical Findings" value={totalCritical} icon={AlertTriangle} color="bg-red-500/15" />
        <StatCard label="High Findings" value={totalHigh} icon={TrendingUp} color="bg-orange-500/15" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Scans */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Recent Scans</h2>
            <Link href="/dashboard/scans" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {latestScans.length === 0 ? (
            <div className="text-center py-10 text-slate-600">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No scans yet. <Link href="/dashboard/projects/new" className="text-violet-400">Start a scan</Link></p>
            </div>
          ) : (
            <div className="space-y-2">
              {latestScans.map(scan => (
                <Link
                  key={scan.id}
                  href={`/dashboard/scans/${scan.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800/40 transition-colors group"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    scan.status === 'COMPLETED' ? 'bg-emerald-400' :
                    scan.status === 'FAILED' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{scan.project_name}</p>
                    <p className="text-xs text-slate-500 truncate">{scan.ref} · {timeAgo(scan.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {scan.risk_score !== null && (
                      <span className={`text-sm font-bold ${riskScoreColor(scan.risk_score)}`}>{scan.risk_score}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(scan.status)}`}>
                      {scan.status}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Risk Gauge + Projects */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h2 className="font-semibold text-slate-200 mb-4">Average Risk Score</h2>
            <RiskGauge score={avgRisk} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="bg-red-500/10 rounded-lg p-2">
                <p className="text-lg font-bold text-red-400">{totalCritical}</p>
                <p className="text-xs text-slate-500">Critical</p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-2">
                <p className="text-lg font-bold text-orange-400">{totalHigh}</p>
                <p className="text-xs text-slate-500">High</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-200">Projects</h2>
              <Link href="/dashboard/projects" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
            </div>
            {projects.slice(0, 4).map(p => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0 hover:opacity-80 transition-opacity">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-400">{p.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate font-medium">{p.name}</p>
                  <p className="text-xs text-slate-600">{p.scans_count} scan{p.scans_count !== 1 ? 's' : ''}</p>
                </div>
                {p.latest_risk_score !== null && (
                  <span className={`text-sm font-bold ${riskScoreColor(p.latest_risk_score)}`}>{p.latest_risk_score}</span>
                )}
              </Link>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4">No projects yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
