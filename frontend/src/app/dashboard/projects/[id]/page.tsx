'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI, scansAPI, Project, Scan, PaginatedResponse } from '@/lib/api';
import { riskScoreColor, statusColor, timeAgo, formatDate } from '@/lib/utils';
import {
  ArrowLeft, GitBranch, Globe, Plus, Clock,
  CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw
} from 'lucide-react';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchData = async () => {
    if (!token || !id) return;
    const [p, s] = await Promise.all([
      projectsAPI.get(token, id),
      scansAPI.list(token),
    ]);
    setProject(p);
    const allScans = (s as PaginatedResponse<Scan>).results || [];
    setScans(allScans.filter(sc => sc.project === id));
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [token, id]);

  const handleScan = async () => {
    if (!token || !project) return;
    setScanning(true);
    try {
      const res = await projectsAPI.startScan(token, project.id, {
        source: 'manual',
        ref: project.default_branch,
        profile: project.scan_profile,
      });
      if (res && res.id) {
        router.push(`/dashboard/scans/${res.id}`);
      } else {
        await fetchData();
      }
    } finally {
      setScanning(false);
    }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 shimmer rounded" />
      <div className="h-32 shimmer rounded-xl" />
    </div>
  );

  if (!project) return (
    <div className="p-6 text-center text-slate-500">Project not found.</div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/projects" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors">
                <Globe className="w-3.5 h-3.5" />
                {project.repo_url.replace('https://', '')}
              </a>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <GitBranch className="w-3.5 h-3.5" /> {project.default_branch}
              </span>
              <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                {project.scan_profile}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {project.latest_risk_score !== null && (
              <div className="text-center">
                <p className={`text-3xl font-bold ${riskScoreColor(project.latest_risk_score)}`}>
                  {project.latest_risk_score}
                </p>
                <p className="text-xs text-slate-600">Risk Score</p>
              </div>
            )}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Starting...' : 'New Scan'}
            </button>
          </div>
        </div>
      </div>

      {/* Scan History */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-slate-200 mb-4">Scan History</h2>
        {scans.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No scans yet. Start a scan to see results.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map(scan => (
              <Link
                key={scan.id}
                href={`/dashboard/scans/${scan.id}`}
                className="flex items-center gap-4 p-3.5 rounded-lg hover:bg-slate-800/40 transition-colors group border border-transparent hover:border-slate-700/40"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  scan.status === 'COMPLETED' ? 'bg-emerald-400' :
                  scan.status === 'FAILED' ? 'bg-red-400' :
                  'bg-yellow-400 animate-pulse'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200">{scan.ref}</p>
                    {scan.commit_sha && (
                      <span className="text-xs text-slate-600 font-mono">{scan.commit_sha.substring(0, 7)}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(scan.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {scan.status === 'COMPLETED' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-400">{scan.critical_count}C</span>
                      <span className="text-orange-400">{scan.high_count}H</span>
                      <span className="text-yellow-400">{scan.medium_count}M</span>
                    </div>
                  )}
                  {scan.risk_score !== null && (
                    <span className={`font-bold ${riskScoreColor(scan.risk_score)}`}>{scan.risk_score}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(scan.status)}`}>
                    {scan.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
