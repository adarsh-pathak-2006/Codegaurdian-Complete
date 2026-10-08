'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI, Project, PaginatedResponse } from '@/lib/api';
import { riskScoreColor, timeAgo } from '@/lib/utils';
import { Plus, Search, ShieldCheck, ExternalLink, Globe } from 'lucide-react';

export default function ProjectsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token) return;
    projectsAPI.list(token)
      .then(r => setProjects((r as PaginatedResponse<Project>).results || []))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.repo_url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">{projects.length} connected repositor{projects.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 text-sm transition-all"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 shimmer rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <ShieldCheck className="w-14 h-14 mx-auto mb-4 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-400 mb-2">No projects yet</h2>
          <p className="text-sm text-slate-600 mb-5">Connect a repository to start scanning for vulnerabilities.</p>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add First Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="glass-card p-5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">{p.name.charAt(0).toUpperCase()}</span>
                </div>
                {p.latest_risk_score !== null && (
                  <div className={`text-xl font-bold ${riskScoreColor(p.latest_risk_score)} tabular-nums`}>
                    {p.latest_risk_score}
                    <span className="text-xs text-slate-600 font-normal">/100</span>
                  </div>
                )}
              </div>

              <h3 className="font-semibold text-slate-200 mb-1 group-hover:text-white transition-colors">{p.name}</h3>
              {p.description && (
                <p className="text-xs text-slate-500 mb-2 line-clamp-2">{p.description}</p>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
                <Globe className="w-3 h-3" />
                <span className="truncate">{p.repo_url.replace('https://', '').replace('http://', '')}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{p.scans_count} scan{p.scans_count !== 1 ? 's' : ''}</span>
                <span className="text-xs text-slate-500">{timeAgo(p.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
