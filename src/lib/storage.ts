/**
 * Self-Hosted Local Persistence Provider for EIDOS
 * 100% self-contained in-memory & localStorage store.
 * Zero external cloud lock-in.
 */
import { Project, CatalogItem } from '../types';

export interface LocalUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

let currentUser: LocalUser | null = {
  uid: 'local-operator',
  displayName: 'Self-Hosted Operator',
  email: 'operator@eidos.local',
};

type AuthListener = (user: LocalUser | null) => void;
const authListeners: AuthListener[] = [];

export const auth = {
  get currentUser() {
    return currentUser;
  },
};

export const onAuthStateChanged = (_authObj: any, callback: AuthListener) => {
  authListeners.push(callback);
  callback(currentUser);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx >= 0) authListeners.splice(idx, 1);
  };
};

export const loginWithGoogle = async (): Promise<LocalUser> => {
  currentUser = {
    uid: 'local-operator',
    displayName: 'Self-Hosted Operator',
    email: 'operator@eidos.local',
  };
  authListeners.forEach((cb) => cb(currentUser));
  return currentUser;
};

export const logoutUser = async (): Promise<void> => {
  currentUser = null;
  authListeners.forEach((cb) => cb(null));
};

export const testFirestoreConnection = async (): Promise<boolean> => {
  return true;
};

export const syncProjectsToCloud = async (userId: string, projects: Project[]): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`eidos_projects_${userId}`, JSON.stringify(projects));
    }
  } catch (err) {
    console.warn('Local storage write warning:', err);
  }
};

export const fetchProjectsFromCloud = async (userId: string): Promise<Project[]> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(`eidos_projects_${userId}`);
      if (data) return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Local storage read warning:', err);
  }
  return [];
};

export const syncCatalogToCloud = async (userId: string, items: CatalogItem[]): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`eidos_catalog_${userId}`, JSON.stringify(items));
    }
  } catch (err) {
    console.warn('Local storage write warning:', err);
  }
};

export const fetchCatalogFromCloud = async (userId: string): Promise<CatalogItem[]> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(`eidos_catalog_${userId}`);
      if (data) return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Local storage read warning:', err);
  }
  return [];
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
