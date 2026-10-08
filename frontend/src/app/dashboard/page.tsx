'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI, scansAPI, Project, Scan, PaginatedResponse } from '@/lib/api';
import { riskScoreColor, statusColor, severityColor, timeAgo, formatDate } from '@/lib/utils';
import {
  ShieldCheck, TrendingUp, AlertTriangle, Activity,
  ArrowRight, Plus, Clock, CheckCircle2, Zap, GitBranch,
  FileText, ShieldAlert, Sparkles, RefreshCw, FolderOpen, ChevronRight
} from 'lucide-react';

function StatCard({
  label, value, sub, color, icon: Icon, badge
}: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ElementType; badge?: string;
}) {
  return (
    <div className="glass-card p-5 relative overflow-hidden group hover:border-violet-500/30 transition-all">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color || 'bg-violet-500/15 border border-violet-500/20'}`}>
          <Icon className="w-5 h-5 text-violet-400" />
        </div>
        {badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-extrabold text-slate-100 tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function RiskGauge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center justify-center py-5 text-center">
        <span className="text-2xl font-bold text-slate-600">—</span>
        <p className="text-xs text-slate-500 mt-1">No scan data yet</p>
      </div>
    );
  }

  const s = Math.max(0, Math.min(100, score));
  const angle = (s / 100) * 180;
  const color = s >= 80 ? '#22c55e' : s >= 50 ? '#eab308' : s >= 25 ? '#f97316' : '#ef4444';
  const label = s >= 80 ? 'Grade A · Healthy' : s >= 50 ? 'Grade B · Moderate' : s >= 25 ? 'Grade C · High Risk' : 'Grade F · Critical';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-20 overflow-hidden">
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
          <span className="text-3xl font-black" style={{ color }}>{s}</span>
        </div>
      </div>
      <p className="text-xs font-semibold mt-2" style={{ color }}>{label}</p>
      <p className="text-[10px] text-slate-500">CVSS Aggregate Health Score / 100</p>
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [p, s] = await Promise.all([
        projectsAPI.list(token),
        scansAPI.list(token),
      ]);
      setProjects((p as PaginatedResponse<Project>).results || []);
      setScans((s as PaginatedResponse<Scan>).results || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const latestScans = useMemo(() => scans.slice(0, 6), [scans]);
  const completedScans = useMemo(() => scans.filter(s => s.status === 'COMPLETED'), [scans]);

  const avgRisk = useMemo(() => {
    if (!completedScans.length) return null;
    return Math.round(completedScans.reduce((a, s) => a + (s.risk_score || 0), 0) / completedScans.length);
  }, [completedScans]);

  const totalCritical = useMemo(() => scans.reduce((a, s) => a + s.critical_count, 0), [scans]);
  const totalHigh = useMemo(() => scans.reduce((a, s) => a + s.high_count, 0), [scans]);
  const totalMedium = useMemo(() => scans.reduce((a, s) => a + s.medium_count, 0), [scans]);
  const totalLow = useMemo(() => scans.reduce((a, s) => a + s.low_count, 0), [scans]);
  const totalFindings = totalCritical + totalHigh + totalMedium + totalLow;

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="h-10 w-64 shimmer rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 shimmer rounded-xl" />
        ))}
      </div>
      <div className="h-96 shimmer rounded-xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Security Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time vulnerability detection, CVSS risk scoring, and AI remediation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Link
            href="/dashboard/projects/new"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" /> New Scan
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Projects"
          value={projects.length}
          sub="Monitored repositories"
          icon={FolderOpen}
          badge="Live"
        />
        <StatCard
          label="Security Audits"
          value={scans.length}
          sub={`${completedScans.length} completed`}
          icon={Activity}
          badge="Automated"
        />
        <StatCard
          label="Critical Findings"
          value={totalCritical}
          sub={totalHigh > 0 ? `+${totalHigh} High severity` : "Requires immediate action"}
          icon={AlertTriangle}
          color="bg-red-500/15 border border-red-500/25"
          badge="Priority"
        />
        <StatCard
          label="Total Vulnerabilities"
          value={totalFindings}
          sub={`${totalMedium} Med · ${totalLow} Low`}
          icon={ShieldAlert}
          color="bg-amber-500/15 border border-amber-500/25"
          badge="Catalog"
        />
      </div>

      {/* Critical Threat Alert Banner (if critical issues exist) */}
      {totalCritical > 0 && (
        <div className="glass-card p-4 border-red-500/30 bg-gradient-to-r from-red-950/20 via-slate-900/60 to-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-300">
                Action Required: {totalCritical} Critical vulnerabilities identified
              </p>
              <p className="text-xs text-slate-400">
                Exposed weaknesses require immediate code remediation. AI security patches are available.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/findings?severity=CRITICAL"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Triage Critical Findings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Scans */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-slate-100 text-sm">Recent Security Audits</h2>
                <p className="text-xs text-slate-500">Pipeline runs and automated static analysis scans</p>
              </div>
              <Link href="/dashboard/scans" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium">
                View all ({scans.length}) <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {latestScans.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-slate-400">No scans executed yet</p>
                <Link href="/dashboard/projects/new" className="text-xs text-violet-400 hover:underline mt-1 inline-block">
                  Run your first security scan &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {latestScans.map(scan => (
                  <Link
                    key={scan.id}
                    href={`/dashboard/scans/${scan.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        scan.status === 'COMPLETED' ? 'bg-emerald-400' :
                        scan.status === 'FAILED' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
                      }`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                            {scan.project_name}
                          </p>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                            <GitBranch className="w-3 h-3" /> {scan.ref}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {timeAgo(scan.created_at)} • Profile: <span className="text-slate-400">{scan.profile}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 self-end sm:self-auto">
                      {/* Findings Pill */}
                      {scan.status === 'COMPLETED' && (
                        <div className="flex items-center gap-1 text-[11px] font-mono">
                          {scan.critical_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-bold">
                              {scan.critical_count}C
                            </span>
                          )}
                          {scan.high_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 font-bold">
                              {scan.high_count}H
                            </span>
                          )}
                          {scan.medium_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                              {scan.medium_count}M
                            </span>
                          )}
                        </div>
                      )}

                      {/* Explicit Risk Score Badge */}
                      <div className="text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          scan.risk_score !== null && scan.risk_score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                          scan.risk_score !== null && scan.risk_score >= 50 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                          scan.risk_score !== null && scan.risk_score >= 25 ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' :
                          'text-red-400 bg-red-500/10 border-red-500/30'
                        }`}>
                          Score: {scan.risk_score !== null ? `${scan.risk_score}/100` : '—'}
                        </span>
                      </div>

                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${statusColor(scan.status)}`}>
                        {scan.status}
                      </span>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Vulnerability Severity Distribution Bar */}
          {totalFindings > 0 && (
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Vulnerability Severity Distribution
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  {totalFindings} Total Findings
                </span>
              </div>

              {/* Segmented Bar */}
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-800">
                {totalCritical > 0 && (
                  <div
                    style={{ width: `${(totalCritical / totalFindings) * 100}%` }}
                    className="h-full bg-red-500 rounded-sm"
                    title={`Critical: ${totalCritical}`}
                  />
                )}
                {totalHigh > 0 && (
                  <div
                    style={{ width: `${(totalHigh / totalFindings) * 100}%` }}
                    className="h-full bg-orange-500 rounded-sm"
                    title={`High: ${totalHigh}`}
                  />
                )}
                {totalMedium > 0 && (
                  <div
                    style={{ width: `${(totalMedium / totalFindings) * 100}%` }}
                    className="h-full bg-yellow-500 rounded-sm"
                    title={`Medium: ${totalMedium}`}
                  />
                )}
                {totalLow > 0 && (
                  <div
                    style={{ width: `${(totalLow / totalFindings) * 100}%` }}
                    className="h-full bg-blue-500 rounded-sm"
                    title={`Low: ${totalLow}`}
                  />
                )}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-slate-400">Critical:</span>
                  <span className="font-bold text-red-400">{totalCritical}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-slate-400">High:</span>
                  <span className="font-bold text-orange-400">{totalHigh}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="text-slate-400">Medium:</span>
                  <span className="font-bold text-yellow-400">{totalMedium}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-400">Low:</span>
                  <span className="font-bold text-blue-400">{totalLow}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/dashboard/projects/new"
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
              </div>
              <p className="text-sm font-bold text-slate-200">Connect Repository</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Scan public or private GitHub repository</p>
            </Link>

            <Link
              href="/dashboard/findings"
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="text-sm font-bold text-slate-200">Triage Workbench</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Generate AI fixes and change triage states</p>
            </Link>

            <Link
              href="/dashboard/reports"
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-sm font-bold text-slate-200">Audit Reports</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Export compliance HTML and JSON reports</p>
            </Link>
          </div>
        </div>

        {/* Right Column (Span 1) */}
        <div className="space-y-6">
          {/* Risk Gauge Card */}
          <div className="glass-card p-5">
            <h2 className="font-bold text-slate-200 text-sm mb-4">Overall Security Posture</h2>
            <RiskGauge score={avgRisk} />

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                <p className="text-lg font-extrabold text-red-400">{totalCritical}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Critical</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5">
                <p className="text-lg font-extrabold text-orange-400">{totalHigh}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">High</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                <p className="text-lg font-extrabold text-yellow-400">{totalMedium}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Medium</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                <p className="text-lg font-extrabold text-blue-400">{totalLow}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Low</p>
              </div>
            </div>
          </div>

          {/* Connected Projects */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-slate-200 text-sm">Repositories</h2>
                <p className="text-[11px] text-slate-500">{projects.length} connected project{projects.length !== 1 ? 's' : ''}</p>
              </div>
              <Link href="/dashboard/projects" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
                View all
              </Link>
            </div>

            <div className="space-y-1">
              {projects.slice(0, 5).map(p => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-900/50 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">{p.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate font-semibold group-hover:text-white transition-colors">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {p.scans_count} scan{p.scans_count !== 1 ? 's' : ''} • {p.default_branch}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-bold block ${riskScoreColor(p.latest_risk_score)}`}>
                      {p.latest_risk_score !== null ? `${p.latest_risk_score}/100` : '—'}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Risk</span>
                  </div>
                </Link>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-6 text-slate-600">
                  <p className="text-xs">No projects connected yet</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <Link
                href="/dashboard/projects/new"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Connect Another Repo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
