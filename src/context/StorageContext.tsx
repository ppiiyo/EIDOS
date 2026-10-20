import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  loadProjectsFromIdb,
  saveProjectsToIdb,
  saveBinaryEmbeddingsToIdb,
  loadBinaryEmbeddingsFromIdb,
} from '../lib/storage';
import { hydrateAnalyticsFromIdb } from '../lib/analytics/tracker';
import { hydrateExperimentsFromIdb } from '../lib/ab-testing/engine';
import { Project } from '../types';

interface StorageContextType {
  ready: boolean;
  projects: Project[];
  saveProjects: (projects: Project[]) => Promise<void>;
  saveEmbeddings: (embeddings: Map<string, Float32Array>) => Promise<void>;
  loadEmbeddings: () => Promise<Map<string, Float32Array>>;
}

const StorageContext = createContext<StorageContextType | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadProjectsFromIdb(),
      hydrateAnalyticsFromIdb(),
      hydrateExperimentsFromIdb(),
    ])
      .then(([loadedProjects]) => {
        if (!active) return;
        setProjects(loadedProjects);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSaveProjects = async (next: Project[]) => {
    setProjects(next);
    await saveProjectsToIdb(next);
  };

  return (
    <StorageContext.Provider
      value={{
        ready,
        projects,
        saveProjects: handleSaveProjects,
        saveEmbeddings: saveBinaryEmbeddingsToIdb,
        loadEmbeddings: loadBinaryEmbeddingsFromIdb,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): StorageContextType {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
}
