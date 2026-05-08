import type { AgentEvent } from '@dstack/shared';

const API_BASE = 'http://localhost:3001/api';

export interface WorkflowRunStartResponse {
  runId: string;
  status: string;
  createdAt: string;
}

export interface SandboxCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function safeFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
    return res.json();
  } catch (err) {
    console.error('Network or API Error:', err);
    throw err;
  }
}

export const apiClient = {
  getProject() {
    return safeFetch<Record<string, unknown>>(`${API_BASE}/project`);
  },
  getSkills() {
    return safeFetch<Record<string, unknown>[]>(`${API_BASE}/skills`);
  },
  getArtifacts() {
    return safeFetch<Record<string, unknown>[]>(`${API_BASE}/artifacts`);
  },
  getRuns() {
    return safeFetch<Record<string, unknown>[]>(`${API_BASE}/runs`);
  },
  runSkill(skillName: string, args: Record<string, string> = {}) {
    return safeFetch<{ runId: string }>(`${API_BASE}/skills/${skillName}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
  },
  streamRun(runId: string, onEvent: (event: Record<string, unknown>) => void, onComplete: () => void) {
    const eventSource = new EventSource(`${API_BASE}/runs/${runId}/stream`);
    
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onEvent(data);
      if (data.type === 'complete') {
        eventSource.close();
        onComplete();
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE Error:', e);
      eventSource.close();
      onComplete();
    };

    return () => eventSource.close();
  },
  respondToApproval(runId: string, decision: 'approve' | 'deny') {
    return safeFetch<{ success: boolean }>(`${API_BASE}/approvals/${runId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
  },
  updateProjectSettings(settings: { safetyMode?: string, freezeState?: boolean, providerMode?: string }) {
    return safeFetch<Record<string, unknown>>(`${API_BASE}/project/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  },
  startWorkflow(prompt: string) {
    return safeFetch<WorkflowRunStartResponse>(`${API_BASE}/workflows/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
  },
  streamWorkflow(runId: string, onEvent: (event: AgentEvent) => void, onComplete: () => void) {
    const eventSource = new EventSource(`${API_BASE}/workflows/runs/${runId}/stream`);
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data) as AgentEvent;
      onEvent(data);
      if (data.type === 'run_complete' || data.type === 'run_error') {
        eventSource.close();
        onComplete();
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      onComplete();
    };
    return () => eventSource.close();
  },
  respondToWorkflowApproval(runId: string, decision: 'approve' | 'deny') {
    return safeFetch<{ ok: boolean }>(`${API_BASE}/workflows/runs/${runId}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
  },
  writeSandboxFiles(files: Record<string, string>) {
    return safeFetch<Record<string, unknown>>(`${API_BASE}/sandbox/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
  },
  runSandboxCommand(command: string) {
    return safeFetch<SandboxCommandResult>(`${API_BASE}/sandbox/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
  }
};
