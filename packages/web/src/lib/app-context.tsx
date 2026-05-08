'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  MOCK_PROJECT, MOCK_SKILLS, MOCK_RUNS, MOCK_ARTIFACTS, MOCK_WORKFLOW,
  MOCK_BROWSER_SNAPSHOTS, MOCK_DEPLOY_RUNS, MOCK_BENCHMARK_RUNS, MOCK_LEARNINGS, MOCK_EXECUTION_SESSION,
  type Artifact,
  type BenchmarkRun,
  type BrowserSnapshot,
  type DeployRun,
  type ExecutionTurn,
  type Learning,
  type Project,
  type Skill,
  type SkillRun,
  type WorkflowGraph
} from './mock-data';

interface AppState {
  project: Project;
  skills: Skill[];
  runs: SkillRun[];
  artifacts: Artifact[];
  workflow: WorkflowGraph;
  snapshots: BrowserSnapshot[];
  deployRuns: DeployRun[];
  benchmarkRuns: BenchmarkRun[];
  learnings: Learning[];
  executionSession: ExecutionTurn[];
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  addRun: (run: SkillRun) => void;
  updateProject: (partial: Partial<Project>) => void;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  isLoading: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const AppContext = createContext<AppState | null>(null);

import { apiClient } from './api-client';

export function AppProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project>(MOCK_PROJECT);
  const [skills, setSkills] = useState<Skill[]>(MOCK_SKILLS);
  const [artifacts, setArtifacts] = useState<Artifact[]>(MOCK_ARTIFACTS);
  const [workflow, setWorkflow] = useState<WorkflowGraph>(MOCK_WORKFLOW);
  const [runs, setRuns] = useState<SkillRun[]>(MOCK_RUNS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  React.useEffect(() => {
    async function loadData() {
      try {
        const [projRes, skillsRes, artifactsRes, runsRes] = await Promise.all([
          apiClient.getProject().catch(() => null),
          apiClient.getSkills().catch(() => null),
          apiClient.getArtifacts().catch(() => null),
          apiClient.getRuns().catch(() => null)
        ]);

        if (projRes) {
          const backendProject = projRes as {
            name?: string;
            safetyMode?: Project['safetyMode']['mode'];
            providerMode?: string;
            branch?: string;
            head?: string;
            stage?: string;
          };
          setProject(prev => ({
            ...prev,
            name: backendProject.name ?? prev.name,
            safetyMode: { mode: backendProject.safetyMode ?? prev.safetyMode.mode, reason: prev.safetyMode.reason },
            provider: { current: backendProject.providerMode === 'FAKE' ? 'fake' : 'gemini', geminiConfigured: true }
          }));
          
          setWorkflow(prev => ({
            ...prev,
            currentStage: backendProject.stage || prev.currentStage
          }));
        }

        if (skillsRes && Array.isArray(skillsRes)) {
          setSkills(skillsRes as unknown as Skill[]);
        }

        if (runsRes && Array.isArray(runsRes)) {
          setRuns(runsRes as unknown as SkillRun[]);
        }

        if (artifactsRes && Array.isArray(artifactsRes)) {
          // Map backend artifacts to UI artifacts
          setArtifacts((artifactsRes as Array<{
            skillName: string;
            timestamp: string;
            verdict?: Artifact['verdict'];
            path: string;
            content?: Artifact['content'];
          }>).map(a => ({
            id: `${a.skillName}-${a.timestamp}`,
            skillName: a.skillName,
            artifactType: 'skill-output',
            version: 'v1',
            isLatest: true,
            verdict: a.verdict || 'FAIL',
            createdAt: a.timestamp,
            relativePath: a.path.split('.dstack/')[1] || a.path,
            summary: `${a.verdict} result from ${a.skillName}`,
            warnings: [],
            content: a.content || { note: 'Artifact data available on click' }
          })));
        }
      } catch (err) {
        console.error('Failed to load initial data from backend:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    
    // Auto-refresh every 5 seconds to keep artifacts up to date
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const addRun = (run: SkillRun) => setRuns(prev => [run, ...prev]);
  const updateProject = (partial: Partial<Project>) =>
    setProject(prev => ({ ...prev, ...partial }));

  return (
    <AppContext.Provider value={{
      project,
      skills,
      runs,
      artifacts,
      workflow,
      snapshots: MOCK_BROWSER_SNAPSHOTS,
      deployRuns: MOCK_DEPLOY_RUNS,
      benchmarkRuns: MOCK_BENCHMARK_RUNS,
      learnings: MOCK_LEARNINGS,
      executionSession: MOCK_EXECUTION_SESSION,
      sidebarCollapsed,
      setSidebarCollapsed,
      addRun,
      updateProject,
      toast: showToast,
      isLoading,
    }}>
      {children}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
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
