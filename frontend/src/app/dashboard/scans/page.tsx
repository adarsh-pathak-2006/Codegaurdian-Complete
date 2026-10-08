'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { scansAPI, Scan, PaginatedResponse } from '@/lib/api';
import { riskScoreColor, statusColor, formatDate, timeAgo } from '@/lib/utils';
import {
  Activity, ArrowRight, CheckCircle2, Clock,
  Filter, Plus, RefreshCw, Search, ShieldAlert
} from 'lucide-react';

export default function ScansPage() {
  const { token } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const fetchScans = async () => {
    if (!token) return;
    try {
      const res = await scansAPI.list(token);
      setScans((res as PaginatedResponse<Scan>).results || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [token]);

  const filtered = scans.filter(s => {
    const matchesStatus = filterStatus === 'ALL' || s.status.toUpperCase() === filterStatus;
    const matchesSearch =
      s.project_name.toLowerCase().includes(search.toLowerCase()) ||
      s.ref.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Security Scans</h1>
          <p className="text-sm text-slate-500 mt-1">Audit runs, pipeline stages, and static analysis outputs.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); fetchScans(); }}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm font-medium rounded-lg border border-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Link
            href="/dashboard/projects/new"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" /> Start Scan
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by project or branch..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 text-sm transition-all"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'COMPLETED', 'SCANNING', 'FAILED'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Scans List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 shimmer rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-400 mb-1">No scans found</h2>
          <p className="text-xs text-slate-600 mb-4">Start a new scan from the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(scan => (
            <Link
              key={scan.id}
              href={`/dashboard/scans/${scan.id}`}
              className="glass-card p-4 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="flex items-start md:items-center gap-3.5 min-w-0">
                <div className={`w-3 h-3 rounded-full mt-1.5 md:mt-0 flex-shrink-0 ${
                  scan.status === 'COMPLETED' ? 'bg-emerald-400' :
                  scan.status === 'FAILED' ? 'bg-red-400' :
                  'bg-blue-400 animate-pulse'
                }`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-200 group-hover:text-violet-300 transition-colors">
                      {scan.project_name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                      {scan.ref}
                    </span>
                    {scan.commit_sha && (
                      <span className="text-xs text-slate-600 font-mono">
                        {scan.commit_sha.substring(0, 7)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(scan.created_at)}</span>
                    <span>•</span>
                    <span>Profile: {scan.profile}</span>
                  </p>
                </div>
              </div>

              {/* Status & Stats */}
              <div className="flex items-center justify-between md:justify-end gap-5 flex-shrink-0">
                {scan.status === 'COMPLETED' && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                      {scan.critical_count}C
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
                      {scan.high_count}H
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                      {scan.medium_count}M
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      {scan.low_count}L
                    </span>
                  </div>
                )}

                {scan.risk_score !== null && (
                  <div className="text-right">
                    <span className={`text-lg font-bold ${riskScoreColor(scan.risk_score)}`}>
                      {scan.risk_score}
                    </span>
                    <span className="text-[10px] text-slate-600 block -mt-1">Risk</span>
                  </div>
                )}

                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor(scan.status)}`}>
                  {scan.status}
                </span>

                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors hidden sm:block" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
