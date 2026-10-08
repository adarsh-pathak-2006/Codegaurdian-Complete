'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { scansAPI, Scan, PaginatedResponse } from '@/lib/api';
import { riskScoreColor, formatDate } from '@/lib/utils';
import {
  FileText, Download, ShieldCheck, CheckCircle2,
  ExternalLink, Clock, FileCode
} from 'lucide-react';

export default function ReportsPage() {
  const { token } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    scansAPI.list(token)
      .then(res => {
        const all = (res as PaginatedResponse<Scan>).results || [];
        setScans(all.filter(s => s.status === 'COMPLETED'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Security Reports & Compliance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export audit-ready executive reports and machine-readable vulnerability digests.
        </p>
      </div>

      {/* Feature banner */}
      <div className="glass-card p-6 border-violet-500/30 bg-gradient-to-r from-violet-950/20 via-slate-900/40 to-slate-900/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" /> Comprehensive Executive Security Audit
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Each scan produces a full standalone HTML report with CVSS breakdown, dependency inventory, and line-level remediation instructions suitable for compliance audits (SOC2, ISO 27001).
          </p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-200 mb-4">Completed Audit Reports</h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-xl" />
            ))}
          </div>
        ) : scans.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No completed scans yet available for reporting.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map(scan => (
              <div
                key={scan.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 text-sm">{scan.project_name}</span>
                    <span className="text-xs text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {scan.ref}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Completed {formatDate(scan.completed_at || scan.created_at)}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-300">
                      Findings: {scan.critical_count + scan.high_count + scan.medium_count + scan.low_count}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {scan.risk_score !== null && (
                    <div className="text-right mr-2">
                      <span className={`text-base font-bold ${riskScoreColor(scan.risk_score)}`}>
                        {scan.risk_score}
                      </span>
                      <span className="text-[10px] text-slate-500 block -mt-1">Risk</span>
                    </div>
                  )}

                  <a
                    href={scansAPI.reportHtmlUrl(scan.id, token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> HTML Report
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
