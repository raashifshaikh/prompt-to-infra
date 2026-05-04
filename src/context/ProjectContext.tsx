import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Project } from '@/types/project';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'backendforge_projects_';

// Map a DB row -> Project shape used by the UI
function rowToProject(r: any): Project {
  return {
    id: r.id,
    name: r.name,
    backendType: r.backend_type,
    prompt: r.prompt ?? '',
    result: r.result ?? null,
    createdAt: r.created_at,
    status: r.status,
    supabaseProjectUrl: r.supabase_project_url ?? undefined,
    supabaseDbPassword: r.supabase_db_password ?? undefined,
    supabaseConfig: r.supabase_config ?? undefined,
    firebaseConfig: r.firebase_config ?? undefined,
    railwayDeployment: r.railway_deployment ?? undefined,
    repoSource: r.repo_source ?? undefined,
    envVars: r.env_vars ?? undefined,
    resultHistory: r.result_history ?? undefined,
    securityScore: r.security_score ?? undefined,
  };
}

function projectToRow(p: Partial<Project>, userId: string): Record<string, any> {
  const row: Record<string, any> = {};
  if (p.id !== undefined) row.id = p.id;
  row.user_id = userId;
  if (p.name !== undefined) row.name = p.name;
  if (p.backendType !== undefined) row.backend_type = p.backendType;
  if (p.prompt !== undefined) row.prompt = p.prompt;
  if (p.result !== undefined) row.result = p.result as any;
  if (p.status !== undefined) row.status = p.status;
  if (p.createdAt !== undefined) row.created_at = p.createdAt;
  if (p.supabaseProjectUrl !== undefined) row.supabase_project_url = p.supabaseProjectUrl;
  if (p.supabaseDbPassword !== undefined) row.supabase_db_password = p.supabaseDbPassword;
  if (p.supabaseConfig !== undefined) row.supabase_config = p.supabaseConfig as any;
  if (p.firebaseConfig !== undefined) row.firebase_config = p.firebaseConfig as any;
  if (p.railwayDeployment !== undefined) row.railway_deployment = p.railwayDeployment as any;
  if (p.repoSource !== undefined) row.repo_source = p.repoSource as any;
  if (p.envVars !== undefined) row.env_vars = p.envVars as any;
  if (p.resultHistory !== undefined) row.result_history = p.resultHistory as any;
  if (p.securityScore !== undefined) row.security_score = p.securityScore;
  return row;
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;

  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects when user changes (cloud first, localStorage fallback for offline)
  useEffect(() => {
    if (!userId) { setProjects([]); return; }
    let cancelled = false;
    (async () => {
      // Optimistic: hydrate from cache
      try {
        const cached = storageKey && localStorage.getItem(storageKey);
        if (cached && !cancelled) setProjects(JSON.parse(cached));
      } catch { /* ignore */ }
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (!error && data) {
        const list = data.map(rowToProject);
        setProjects(list);
        if (storageKey) {
          try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch { /* ignore */ }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId, storageKey]);

  // Cache to localStorage on every change for resilience
  useEffect(() => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(projects)); } catch { /* ignore */ }
    }
  }, [projects, storageKey]);

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [project, ...prev]);
    if (!userId) return;
    supabase.from('projects').upsert(projectToRow(project, userId) as any).then(({ error }) => {
      if (error) console.error('addProject upsert failed:', error.message);
    });
  }, [userId]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (!userId) return;
    const row = projectToRow(updates, userId);
    delete (row as any).user_id; // don't overwrite owner
    delete (row as any).id;
    supabase.from('projects').update(row as any).eq('id', id).eq('user_id', userId).then(({ error }) => {
      if (error) console.error('updateProject failed:', error.message);
    });
  }, [userId]);

  const getProject = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (!userId) return;
    supabase.from('projects').delete().eq('id', id).eq('user_id', userId).then(({ error }) => {
      if (error) console.error('deleteProject failed:', error.message);
    });
  }, [userId]);

  return (
    <ProjectContext.Provider value={{ projects, addProject, updateProject, getProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
};
