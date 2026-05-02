const API_BASE = 'http://localhost:3001/api';

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
    return safeFetch<any>(`${API_BASE}/project`);
  },
  getSkills() {
    return safeFetch<any[]>(`${API_BASE}/skills`);
  },
  getArtifacts() {
    return safeFetch<any[]>(`${API_BASE}/artifacts`);
  },
  getRuns() {
    return safeFetch<any[]>(`${API_BASE}/runs`);
  },
  runSkill(skillName: string, args: Record<string, string> = {}) {
    return safeFetch<any>(`${API_BASE}/skills/${skillName}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
  },
  streamRun(runId: string, onEvent: (event: any) => void, onComplete: () => void) {
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
    return safeFetch<any>(`${API_BASE}/approvals/${runId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
  },
  updateProjectSettings(settings: { safetyMode?: string, freezeState?: boolean, providerMode?: string }) {
    return safeFetch<any>(`${API_BASE}/project/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  }
};
