'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI } from '@/lib/api';
import { isGithubUrl } from '@/lib/utils';
import {
  Globe, ShieldCheck, ArrowLeft, ChevronDown,
  GitBranch, Zap, Lock, Search
} from 'lucide-react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const PROFILES = [
  { value: 'quick', label: 'Quick', desc: 'Fast scan, key rules only', icon: Zap },
  { value: 'standard', label: 'Standard', desc: 'Balanced depth and speed', icon: ShieldCheck },
  { value: 'deep', label: 'Deep', desc: 'Comprehensive analysis', icon: Search },
];

export default function NewProjectPage() {
  const { token, orgId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    repo_url: '',
    description: '',
    default_branch: 'main',
    language: 'auto',
    scan_profile: 'standard',
  });

  const urlValid = form.repo_url === '' || isGithubUrl(form.repo_url) || form.repo_url.startsWith('http');
  const isGithub = isGithubUrl(form.repo_url);

  // Auto-fill name from GitHub URL
  const handleUrlChange = (url: string) => {
    setForm(f => ({ ...f, repo_url: url }));
    if (isGithubUrl(url)) {
      const parts = url.replace('.git', '').split('/');
      const repoName = parts[parts.length - 1];
      if (repoName && !form.name) {
        setForm(f => ({ ...f, repo_url: url, name: repoName }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !orgId) return;
    setError('');
    setLoading(true);
    try {
      const project = await projectsAPI.create(token, {
        organization: orgId,
        name: form.name,
        description: form.description,
        repo_url: form.repo_url,
        default_branch: form.default_branch,
        language: form.language,
        scan_profile: form.scan_profile,
      });

      // Auto-trigger scan
      const scan = await projectsAPI.startScan(token, project.id, {
        source: 'manual',
        ref: form.default_branch,
        profile: form.scan_profile,
      });

      router.push(`/dashboard/scans/${scan.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/projects" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">New Security Scan</h1>
        <p className="text-slate-500 text-sm mt-1">Connect a repository and start a comprehensive security analysis.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* GitHub URL Input - Main Hero */}
        <div className="glass-card p-6 glow-purple">
          <label className="block text-sm font-semibold text-slate-200 mb-3">
            <div className="flex items-center gap-2">
              <GithubIcon className="w-4 h-4 text-violet-400" />
              Repository URL
              <span className="text-red-400">*</span>
            </div>
          </label>
          <div className="relative">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-colors ${isGithub ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isGithub ? <GithubIcon className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </div>
            <input
              type="text"
              value={form.repo_url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://github.com/owner/repository"
              required
              className={`w-full pl-10 pr-4 py-3.5 bg-slate-900/60 border rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all text-sm font-mono ${
                !urlValid
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                  : isGithub
                  ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20'
                  : 'border-slate-700/50 focus:border-violet-500/60 focus:ring-violet-500/30'
              }`}
            />
            {isGithub && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                GitHub ✓
              </div>
            )}
          </div>
          {!urlValid && (
            <p className="text-red-400 text-xs mt-1.5">Please enter a valid repository URL</p>
          )}
          <p className="text-xs text-slate-600 mt-2">
            Supports GitHub repositories. For private repos, the backend uses configured credentials.
          </p>
        </div>

        {/* Project Details */}
        <div className="glass-card p-6">
          <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-violet-400" /> Project Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Project Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="my-awesome-project"
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Default Branch
              </label>
              <input
                type="text"
                value={form.default_branch}
                onChange={e => setForm(f => ({ ...f, default_branch: e.target.value }))}
                placeholder="main"
                className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this project..."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Scan Profile */}
        <div className="glass-card p-6">
          <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-violet-400" /> Scan Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROFILES.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm(f => ({ ...f, scan_profile: value }))}
                className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition-all text-left ${
                  form.scan_profile === value
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                    : 'border-slate-700/50 bg-slate-900/30 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{label}</span>
                  {form.scan_profile === value && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                  )}
                </div>
                <p className="text-xs opacity-70">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Engines Info */}
        <div className="glass-card p-5 border-violet-500/10 bg-violet-500/5">
          <h3 className="text-sm font-semibold text-violet-300 mb-3">🔍 Scan Engines Activated</h3>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            {[
              { name: 'SAST', desc: 'Static Analysis', color: 'text-blue-400' },
              { name: 'Secrets', desc: 'Credential Detection', color: 'text-yellow-400' },
              { name: 'SCA', desc: 'Dependency CVEs', color: 'text-green-400' },
            ].map(e => (
              <div key={e.name} className="bg-slate-900/40 rounded-lg p-2.5">
                <p className={`font-bold text-base ${e.color}`}>{e.name}</p>
                <p className="text-slate-500 mt-0.5">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !form.name || !form.repo_url}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl text-sm"
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating project & starting scan...
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              Start Security Scan
            </>
          )}
        </button>
      </form>
    </div>
  );
}
