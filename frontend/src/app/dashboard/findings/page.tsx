'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { findingsAPI, Finding, PaginatedResponse } from '@/lib/api';
import { severityColor, findingStatusColor, timeAgo } from '@/lib/utils';
import {
  ShieldAlert, Search, Filter, ExternalLink,
  Sparkles, FileCode, CheckCircle, RefreshCw
} from 'lucide-react';

export default function FindingsPage() {
  const { token } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchFindings = async () => {
    if (!token) return;
    try {
      const res = await findingsAPI.list(token);
      setFindings((res as PaginatedResponse<Finding>).results || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [token]);

  const filtered = findings.filter(f => {
    const matchesSev = severityFilter === 'ALL' || f.severity === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchesSearch =
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.rule_id.toLowerCase().includes(search.toLowerCase()) ||
      f.location?.file_path.toLowerCase().includes(search.toLowerCase()) ||
      f.project_name?.toLowerCase().includes(search.toLowerCase());
    return matchesSev && matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Vulnerability Triage</h1>
          <p className="text-sm text-slate-500 mt-1">
            Global security findings across projects. Prioritize and remediate issues.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchFindings(); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700/60 transition-colors w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh List
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by rule ID, title, filename or project..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 text-sm transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Severity Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 mr-1 font-medium">Severity:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  severityFilter === sev
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 mr-1 font-medium">Status:</span>
            {['ALL', 'OPEN', 'FIX_IN_PROGRESS', 'FIXED', 'FALSE_POSITIVE'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 shimmer rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/60" />
          <h2 className="text-base font-semibold text-slate-300">No findings discovered</h2>
          <p className="text-xs text-slate-500 mt-1">Try relaxing filter constraints or run a new scan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <div
              key={f.id}
              className="glass-card p-4 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${severityColor(f.severity)}`}>
                    {f.severity}
                  </span>
                  <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                    {f.rule_id}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${findingStatusColor(f.status)}`}>
                    {f.status.replace(/_/g, ' ')}
                  </span>
                  {f.ai_analysis && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <Sparkles className="w-3 h-3" /> AI Solution Ready
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-slate-200 text-sm">{f.title}</h3>

                {f.location && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <FileCode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-300 truncate">{f.location.file_path}</span>
                    <span className="text-slate-500 flex-shrink-0">:{f.location.line_start}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
                <span className="text-xs text-slate-500">{timeAgo(f.created_at)}</span>
                <Link
                  href={`/dashboard/findings/${f.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-lg transition-colors"
                >
                  Analyze & Fix <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
