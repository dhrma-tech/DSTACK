const API_BASE = 'http://localhost:3001/api';

export const apiClient = {
  async getProject() {
    const res = await fetch(`${API_BASE}/project`);
    return res.json();
  },
  async getSkills() {
    const res = await fetch(`${API_BASE}/skills`);
    return res.json();
  },
  async getArtifacts() {
    const res = await fetch(`${API_BASE}/artifacts`);
    return res.json();
  },
  async getRuns() {
    const res = await fetch(`${API_BASE}/runs`);
    return res.json();
  },
  async runSkill(skillName: string, args: Record<string, string> = {}) {
    const res = await fetch(`${API_BASE}/skills/${skillName}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return res.json();
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
  async respondToApproval(runId: string, decision: 'approve' | 'deny') {
    const res = await fetch(`${API_BASE}/approvals/${runId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
    return res.json();
  },
  async updateProjectSettings(settings: { safetyMode?: string, freezeState?: boolean, providerMode?: string }) {
    const res = await fetch(`${API_BASE}/project/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  }
};
