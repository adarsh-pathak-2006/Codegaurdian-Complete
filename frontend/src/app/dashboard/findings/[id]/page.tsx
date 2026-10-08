'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { findingsAPI, Finding } from '@/lib/api';
import { severityColor, findingStatusColor, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Check, Copy, ExternalLink, FileCode,
  ShieldAlert, Sparkles, Terminal, AlertTriangle, Bug, CheckCircle
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'FIX_IN_PROGRESS', label: 'Fix In Progress' },
  { value: 'FIXED', label: 'Fixed / Resolved' },
  { value: 'FALSE_POSITIVE', label: 'False Positive' },
  { value: 'ACCEPTED_RISK', label: 'Accepted Risk' },
];

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchFinding = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await findingsAPI.get(token, id);
      setFinding(data);
      setSelectedStatus(data.status);
      setStatusReason(data.status_reason || '');
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchFinding();
  }, [fetchFinding]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;
    setUpdatingStatus(true);
    try {
      await findingsAPI.updateStatus(token, id, selectedStatus, statusReason);
      await fetchFinding();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!token || !id) return;
    setGeneratingAi(true);
    try {
      await findingsAPI.generateAI(token, id);
      await fetchFinding();
    } finally {
      setGeneratingAi(false);
    }
  };

  const copyPatch = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-40 shimmer rounded" />
        <div className="h-64 shimmer rounded-xl" />
        <div className="h-96 shimmer rounded-xl" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p>Finding details could not be loaded.</p>
      </div>
    );
  }

  const ai = finding.ai_analysis;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Navigation */}
      <div>
        <Link
          href={`/dashboard/scans/${finding.scan}`}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scan Results
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${severityColor(finding.severity)}`}>
              {finding.severity}
            </span>
            <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
              {finding.rule_id}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-md border font-medium ${findingStatusColor(finding.status)}`}>
              {finding.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-500">Detected: {formatDate(finding.created_at)}</p>
        </div>
      </div>

      {/* Main Finding Overview */}
      <div className="glass-card p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-100">{finding.title}</h1>
        <p className="text-sm text-slate-300 leading-relaxed">{finding.description}</p>

        {finding.location && (
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono">
                <FileCode className="w-4 h-4 text-violet-400" />
                {finding.location.file_path}
              </span>
              <span className="text-slate-500">
                Lines {finding.location.line_start} to {finding.location.line_end}
              </span>
            </div>

            {finding.location.code_context && (
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Vulnerable Code Snippet</span>
                  <span className="text-slate-500">ReadOnly Context</span>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {finding.location.code_context}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Remediation Engine */}
      <div className="glass-card p-6 glow-purple border-violet-500/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">AI Remediation & Security Intelligence</h2>
              <p className="text-xs text-slate-400">Context-aware fix generation with automated threat modeling</p>
            </div>
          </div>

          {!ai && (
            <button
              onClick={handleGenerateAI}
              disabled={generatingAi}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow-lg disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
              {generatingAi ? 'Analyzing finding...' : 'Generate AI Fix'}
            </button>
          )}
        </div>

        {ai ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-violet-950/20 rounded-lg border border-violet-500/20 text-xs">
              <span className="text-violet-300 font-medium">Model: {ai.model} • Prompt v{ai.prompt_version}</span>
              <span className="text-emerald-400 font-bold">Confidence: {Math.round(ai.confidence * 100)}%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Why It Is A Problem
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">{ai.why_it_is_a_problem}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5" /> Attack Scenario
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">{ai.attack_scenario}</p>
              </div>
            </div>

            {/* Recommended Fix */}
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Recommended Remediation
                </h3>
                <button
                  onClick={() => copyPatch(ai.recommended_fix)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap border border-slate-900">
                {ai.recommended_fix}
              </pre>
            </div>

            {ai.patch_strategy && (
              <div className="p-3 bg-slate-900/40 rounded-lg text-xs text-slate-400 border border-slate-850">
                <span className="font-semibold text-slate-300">Patch Strategy: </span>
                {ai.patch_strategy}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-violet-400" />
            <p className="text-xs">No AI remediation generated yet for this finding.</p>
            <p className="text-[11px] text-slate-600">Click &ldquo;Generate AI Fix&rdquo; above to receive a verified remediation plan.</p>
          </div>
        )}
      </div>

      {/* Triage & Status Resolution Form */}
      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-100 mb-4">Triage Status & Audit Notes</h2>
        <form onSubmit={handleStatusUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Status Transition</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/60 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Resolution Reason / Comment</label>
              <input
                type="text"
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                placeholder="e.g., False positive verified by security lead..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/60 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500 placeholder-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={updatingStatus}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            {updatingStatus ? 'Updating...' : 'Save Triage State'}
          </button>
        </form>
      </div>
    </div>
  );
}
