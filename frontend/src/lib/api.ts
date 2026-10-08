// CodeGuardian API Client
// Typed API service layer connecting to Django DRF backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  organizations: { id: string; name: string; role: string }[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Project {
  id: string;
  organization: string;
  organization_name: string;
  name: string;
  description: string;
  repo_url: string;
  default_branch: string;
  language: string;
  scan_profile: string;
  latest_risk_score: number | null;
  scans_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScanJob {
  id: string;
  stage: string;
  status: string;
  retry_count: number;
  duration_ms: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string;
}

export interface Scan {
  id: string;
  project: string;
  project_name: string;
  organization_name: string;
  source: string;
  ref: string;
  commit_sha: string;
  status: string;
  profile: string;
  risk_score: number | null;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  error_message: string;
  jobs?: ScanJob[];
}

export interface FindingLocation {
  file_path: string;
  line_start: number;
  line_end: number;
  code_context: string;
}

export interface FindingEvidence {
  scanner: string;
  scanner_version: string;
  raw_output: Record<string, unknown>;
  normalized_evidence: string;
}

export interface AIAnalysis {
  id: string;
  model: string;
  prompt_version: string;
  summary: string;
  why_it_is_a_problem: string;
  attack_scenario: string;
  recommended_fix: string;
  patch_strategy: string;
  confidence: number;
  needs_human_review: boolean;
  created_at: string;
}

export interface Finding {
  id: string;
  scan: string;
  project_id: string;
  project_name: string;
  fingerprint: string;
  rule_id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  confidence: number;
  status: string;
  status_reason: string;
  location: FindingLocation | null;
  evidence: FindingEvidence | null;
  ai_analysis: AIAnalysis | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Report {
  meta: { generator: string; generated_at: string | null };
  project: { id: string; name: string; organization: string; repo_url: string; default_branch: string };
  scan: { id: string; status: string; profile: string; risk_score: number | null; started_at: string | null; completed_at: string | null };
  metrics: { critical: number; high: number; medium: number; low: number; total_findings: number; total_dependencies: number };
  findings: Finding[];
  dependencies: unknown[];
}

// ─── API Client ───────────────────────────────────────────────────────────────

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errorData = await res.json();
      errorMsg = errorData.detail || JSON.stringify(errorData) || errorMsg;
    } catch {
      // ignore
    }
    throw new APIError(res.status, errorMsg);
  }

  // Handle empty responses (204 No Content etc.)
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authAPI = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; first_name?: string; organization_name?: string }) =>
    request<{ token: string; user: User }>('/api/v1/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: (token: string) =>
    request<User>('/api/v1/auth/me/', {}, token),
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectsAPI = {
  list: (token: string) =>
    request<PaginatedResponse<Project>>('/api/v1/projects/', {}, token),

  get: (token: string, id: string) =>
    request<Project>(`/api/v1/projects/${id}/`, {}, token),

  create: (token: string, data: {
    organization: string;
    name: string;
    description?: string;
    repo_url: string;
    default_branch?: string;
    language?: string;
    scan_profile?: string;
  }) =>
    request<Project>('/api/v1/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  startScan: (token: string, projectId: string, data: {
    source?: string;
    ref?: string;
    profile?: string;
    commit_sha?: string;
  }) =>
    request<{ id: string; status: string; project_id: string; message: string }>(
      `/api/v1/projects/${projectId}/scans/`,
      { method: 'POST', body: JSON.stringify(data) },
      token
    ),
};

// ─── Scans ────────────────────────────────────────────────────────────────────

export const scansAPI = {
  list: (token: string) =>
    request<PaginatedResponse<Scan>>('/api/v1/scans/', {}, token),

  get: (token: string, id: string) =>
    request<Scan>(`/api/v1/scans/${id}/`, {}, token),

  findings: (token: string, scanId: string, params?: { severity?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Finding[]>(`/api/v1/scans/${scanId}/findings/${qs ? `?${qs}` : ''}`, {}, token);
  },

  report: (token: string, scanId: string) =>
    request<Report>(`/api/v1/scans/${scanId}/report/`, {}, token),

  reportHtmlUrl: (scanId: string, token?: string | null) =>
    `${API_BASE}/api/v1/scans/${scanId}/report-html/${token ? `?token=${encodeURIComponent(token)}` : ''}`,
};


// ─── Findings ─────────────────────────────────────────────────────────────────

export const findingsAPI = {
  list: (token: string, params?: { severity?: string; status?: string; rule_id?: string }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString() : '';
    return request<PaginatedResponse<Finding>>(`/api/v1/findings/${qs ? `?${qs}` : ''}`, {}, token);
  },

  get: (token: string, id: string) =>
    request<Finding>(`/api/v1/findings/${id}/`, {}, token),

  updateStatus: (token: string, id: string, status: string, reason?: string) =>
    request<Finding>(`/api/v1/findings/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, status_reason: reason || '' }),
    }, token),

  generateAI: (token: string, id: string) =>
    request<AIAnalysis>(`/api/v1/findings/${id}/ai-analysis/`, {
      method: 'POST',
    }, token),
};

