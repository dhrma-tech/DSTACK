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

export function AppProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project>(MOCK_PROJECT);
  const [runs, setRuns] = useState<SkillRun[]>(MOCK_RUNS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addRun = (run: SkillRun) => setRuns(prev => [run, ...prev]);
  const updateProject = (partial: Partial<Project>) =>
    setProject(prev => ({ ...prev, ...partial }));

  return (
    <AppContext.Provider value={{
      project,
      skills: MOCK_SKILLS,
      runs,
      artifacts: MOCK_ARTIFACTS,
      workflow: MOCK_WORKFLOW,
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
