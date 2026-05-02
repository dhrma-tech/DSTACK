'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  MOCK_PROJECT, MOCK_SKILLS, MOCK_RUNS, MOCK_ARTIFACTS, MOCK_WORKFLOW,
  MOCK_BROWSER_SNAPSHOTS, MOCK_DEPLOY_RUNS, MOCK_BENCHMARK_RUNS, MOCK_LEARNINGS, MOCK_EXECUTION_SESSION,
  type Project, type Skill, type SkillRun, type Artifact, type WorkflowGraph, type ExecutionTurn,
} from './mock-data';

interface AppState {
  project: Project;
  skills: Skill[];
  runs: SkillRun[];
  artifacts: Artifact[];
  workflow: WorkflowGraph;
  snapshots: any[];
  deployRuns: any[];
  benchmarkRuns: any[];
  learnings: any[];
  executionSession: ExecutionTurn[];
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  addRun: (run: SkillRun) => void;
  updateProject: (partial: Partial<Project>) => void;
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
          setProject(prev => ({
            ...prev,
            name: projRes.name,
            safetyMode: { mode: projRes.safetyMode, activeSession: null },
            provider: { current: projRes.providerMode === 'FAKE' ? 'fake' : 'gemini', isConfigured: true },
            repo: { branch: projRes.branch, head: projRes.head, hasUncommittedChanges: false }
          }));
          
          setWorkflow(prev => ({
            ...prev,
            currentStage: projRes.stage || prev.currentStage
          }));
        }

        if (skillsRes && Array.isArray(skillsRes)) {
          setSkills(skillsRes);
        }

        if (runsRes && Array.isArray(runsRes)) {
          setRuns(runsRes);
        }

        if (artifactsRes && Array.isArray(artifactsRes)) {
          // Map backend artifacts to UI artifacts
          setArtifacts(artifactsRes.map(a => ({
            id: `${a.skillName}-${a.timestamp}`,
            skillName: a.skillName,
            version: 'v1',
            status: a.verdict === 'PASS' ? 'stable' : 'error',
            verdict: a.verdict || 'FAIL',
            createdAt: a.timestamp,
            relativePath: a.path.split('.dstack/')[1] || a.path,
            summary: `${a.verdict} result from /${a.skillName}`,
            content: a.content || { note: 'Artifact data available on click' }
          })));
        }
      } catch (err) {
        console.error('Failed to load initial data from backend:', err);
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
