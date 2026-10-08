'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { scansAPI, findingsAPI, Scan, Finding } from '@/lib/api';
import { riskScoreColor, statusColor, severityColor, formatDate, timeAgo } from '@/lib/utils';
import {
  ArrowLeft, CheckCircle2, Clock, Download, ExternalLink,
  FileCode, FileText, RefreshCw, ShieldAlert, Sparkles, AlertCircle,
  Search, ChevronLeft, ChevronRight, Folder
} from 'lucide-react';

const STAGES = [
  { key: 'prepare', label: '1. Ingestion & Sandbox', desc: 'Secure temporary clone' },
  { key: 'sast', label: '2. Static Analysis', desc: 'AST & semantic security rules' },
  { key: 'secrets', label: '3. Secret Detection', desc: 'High-entropy & credential scans' },
  { key: 'sca', label: '4. Dependency CVEs', desc: 'Software composition analysis' },
  { key: 'normalize', label: '5. Normalization', desc: 'Deduplication & fingerprinting' },
  { key: 'score', label: '6. Risk Scoring', desc: 'CVSS calculation & report synthesis' },
];

const PAGE_SIZE = 15;

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSeverity, setActiveSeverity] = useState<string>('ALL');
  const [findingSearch, setFindingSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [generatingAiFor, setGeneratingAiFor] = useState<string | null>(null);

  const fetchScanData = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [s, f] = await Promise.all([
        scansAPI.get(token, id),
        scansAPI.findings(token, id),
      ]);
      setScan(s);
      setFindings(f || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchScanData();

    // Auto-poll if scan is actively running
    const interval = setInterval(() => {
      if (scan && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(scan.status)) {
        fetchScanData();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchScanData, scan?.status]);

  const handleGenerateAI = async (findingId: string) => {
    if (!token) return;
    setGeneratingAiFor(findingId);
    try {
      await findingsAPI.generateAI(token, findingId);
      await fetchScanData();
    } finally {
      setGeneratingAiFor(null);
    }
  };

  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      const matchesSev = activeSeverity === 'ALL' ? true : f.severity === activeSeverity;
      const q = findingSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        f.title.toLowerCase().includes(q) ||
        f.rule_id.toLowerCase().includes(q) ||
        (f.location?.file_path.toLowerCase().includes(q) ?? false);
      return matchesSev && matchesSearch;
    });
  }, [findings, activeSeverity, findingSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE));
  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFindings.slice(start, start + PAGE_SIZE);
  }, [filteredFindings, currentPage]);

  const isScanning = scan && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(scan.status);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 shimmer rounded" />
        <div className="h-40 shimmer rounded-xl" />
        <div className="h-96 shimmer rounded-xl" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="p-12 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Scan record not found or inaccessible.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link href="/dashboard/scans" className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Scans
            </Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${scan.project}`} className="hover:text-violet-400 transition-colors flex items-center gap-1">
              <Folder className="w-3 h-3" /> {scan.project_name}
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-100">{scan.project_name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusColor(scan.status)}`}>
              {scan.status}
            </span>
            {isScanning && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400">
                <RefreshCw className="w-3 h-3 animate-spin" /> In Progress...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ref: <span className="font-mono text-slate-400">{scan.ref}</span> {scan.commit_sha ? `(${scan.commit_sha.substring(0, 7)})` : ''} • Profile: <span className="text-slate-400">{scan.profile}</span> • Created {formatDate(scan.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchScanData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          {scan.status === 'COMPLETED' && (
            <a
              href={scansAPI.reportHtmlUrl(scan.id, token)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold rounded-lg transition-colors"
            >
              <Download className="w-3 h-3" /> HTML Report
            </a>
          )}
        </div>
      </div>

      {/* Pipeline Stages Progress Card */}
      <div className="glass-card p-5">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4">
          Pipeline Execution Stages
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map((st, idx) => {
            const isCompleted = scan.status === 'COMPLETED';
            const isActive = isScanning;
            return (
              <div
                key={st.key}
                className={`p-3 rounded-lg border transition-all text-left ${
                  isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : isActive && idx <= 2
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-slate-800 bg-slate-900/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-200">{st.label}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isActive && idx <= 2 ? (
                    <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-600" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500">{st.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Risk Score</p>
          <p className={`text-3xl font-extrabold ${riskScoreColor(scan.risk_score)}`}>
            {scan.risk_score !== null ? scan.risk_score : '—'}
          </p>
          <p className="text-[10px] text-slate-600">CVSS Aggregate</p>
        </div>
        <div className="glass-card p-4 text-center border-red-500/20 bg-red-500/5">
          <p className="text-xs text-red-400 font-semibold mb-1">Critical</p>
          <p className="text-3xl font-extrabold text-red-400">{scan.critical_count}</p>
          <p className="text-[10px] text-slate-600">Requires Immediate Fix</p>
        </div>
        <div className="glass-card p-4 text-center border-orange-500/20 bg-orange-500/5">
          <p className="text-xs text-orange-400 font-semibold mb-1">High</p>
          <p className="text-3xl font-extrabold text-orange-400">{scan.high_count}</p>
          <p className="text-[10px] text-slate-600">Urgent Attention</p>
        </div>
        <div className="glass-card p-4 text-center border-yellow-500/20 bg-yellow-500/5">
          <p className="text-xs text-yellow-400 font-semibold mb-1">Medium</p>
          <p className="text-3xl font-extrabold text-yellow-400">{scan.medium_count}</p>
          <p className="text-[10px] text-slate-600">Standard Priority</p>
        </div>
        <div className="glass-card p-4 text-center border-blue-500/20 bg-blue-500/5 col-span-2 sm:col-span-1">
          <p className="text-xs text-blue-400 font-semibold mb-1">Low</p>
          <p className="text-3xl font-extrabold text-blue-400">{scan.low_count}</p>
          <p className="text-[10px] text-slate-600">Informational / Minor</p>
        </div>
      </div>

      {/* Findings Section */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Discovered Vulnerabilities & Findings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredFindings.length} of {findings.length} findings
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
              <button
                key={sev}
                onClick={() => { setActiveSeverity(sev); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  activeSeverity === sev
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input for Findings */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={findingSearch}
            onChange={e => { setFindingSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search by title, rule ID (e.g. python.security), or file path..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {filteredFindings.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/50" />
            <p className="text-sm font-medium text-slate-400">No findings matching active filter</p>
            <p className="text-xs text-slate-600">No vulnerabilities match the criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedFindings.map(finding => {
              const hasAi = !!finding.ai_analysis;
              const isAiLoading = generatingAiFor === finding.id;

              return (
                <div
                  key={finding.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${severityColor(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                        {finding.rule_id}
                      </span>
                      <span className="font-semibold text-slate-200 text-sm">{finding.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateAI(finding.id)}
                        disabled={isAiLoading}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                          hasAi
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-violet-600/20 hover:bg-violet-600/30 border-violet-500/30 text-violet-300'
                        }`}
                      >
                        <Sparkles className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                        {isAiLoading ? 'Analyzing...' : hasAi ? 'AI Remediated ✓' : 'AI Fix Proposal'}
                      </button>

                      <Link
                        href={`/dashboard/findings/${finding.id}`}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        Details <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">{finding.description}</p>

                  {/* Location Context */}
                  {finding.location && (
                    <div className="text-xs text-slate-500 flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md font-mono border border-slate-900">
                      <FileCode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-300 truncate">{finding.location.file_path}</span>
                      <span className="text-slate-500 flex-shrink-0">lines {finding.location.line_start}-{finding.location.line_end}</span>
                    </div>
                  )}

                  {/* AI Quick Preview */}
                  {finding.ai_analysis && (
                    <div className="p-3 bg-violet-950/20 border border-violet-500/20 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-violet-300 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                          AI Suggested Fix Strategy:
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Confidence: {Math.round(finding.ai_analysis.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-slate-300">{finding.ai_analysis.recommended_fix}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
