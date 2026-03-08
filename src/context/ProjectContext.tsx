import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Project } from '@/types/project';
import { useAuth } from '@/context/AuthContext';

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'backendforge_projects_';

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;
  const isLoadingRef = useRef(false);

  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects when user changes
  useEffect(() => {
    if (!storageKey) {
      setProjects([]);
      return;
    }
    isLoadingRef.current = true;
    try {
      const stored = localStorage.getItem(storageKey);
      setProjects(stored ? JSON.parse(stored) : []);
    } catch {
      setProjects([]);
    }
    setTimeout(() => { isLoadingRef.current = false; }, 0);
  }, [storageKey]);

  // Save projects when they change
  useEffect(() => {
    if (storageKey && !isLoadingRef.current) {
      localStorage.setItem(storageKey, JSON.stringify(projects));
    }
  }, [projects, storageKey]);

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [project, ...prev]);
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const getProject = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

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
