'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, DStackAPIError, type SkillSummary, type WorkflowGraph } from './api';
import { EMPTY_PROJECT, toArtifactView, toProjectView, toRunView, type ArtifactView, type ProjectView, type RunView } from './view-models';

const REFRESH_MS = 5000;
const EMPTY_WORKFLOW: WorkflowGraph = { nodes: [], edges: [] };

interface AppState {
  project: ProjectView;
  skills: SkillSummary[];
  runs: RunView[];
  artifacts: ArtifactView[];
  workflow: WorkflowGraph;
  /** True until the first load finishes. */
  isLoading: boolean;
  /** Why the last load failed, or null. Data from the last successful load stays visible. */
  loadError: string | null;
  refresh: () => Promise<void>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const AppContext = createContext<AppState | null>(null);

function describeError(error: unknown): string {
  if (error instanceof DStackAPIError) return error.message;
  return "Can't reach the DStack server. Start it with `pnpm server`.";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectView>(EMPTY_PROJECT);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactView[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowGraph>(EMPTY_WORKFLOW);
  const [runs, setRuns] = useState<RunView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [projectState, artifactList, runList, skillList, graph] = await Promise.all([
        api.getProject(),
        api.getArtifacts(),
        api.getRuns(),
        api.getSkills(),
        api.getWorkflowGraph()
      ]);
      setProject(toProjectView(projectState));
      setArtifacts(artifactList.map(toArtifactView));
      setRuns(runList.map(toRunView));
      setSkills(skillList);
      setWorkflow(graph);
      setLoadError(null);
    } catch (error) {
      setLoadError(describeError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The first load happens in a timer callback, not synchronously in the effect body.
    const first = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <AppContext.Provider value={{
      project, skills, runs, artifacts, workflow, isLoading, loadError, refresh,
      sidebarCollapsed, setSidebarCollapsed, toast: showToast
    }}>
      {children}
      {toasts.length > 0 && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`} style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500,
              boxShadow: 'var(--shadow-md)', animation: 'fadeInUp 0.3s ease-out',
              backgroundColor: t.type === 'error' ? 'var(--color-error)' : t.type === 'success' ? 'var(--color-success)' : 'var(--color-surface)',
              color: t.type === 'error' || t.type === 'success' ? 'white' : 'var(--color-text-primary)',
              border: t.type === 'info' ? '1px solid var(--color-border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
