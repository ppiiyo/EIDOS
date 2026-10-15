import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  auth, 
  onAuthStateChanged,
  loginWithGoogle, 
  logoutUser, 
  syncProjectsToCloud, 
  fetchProjectsFromCloud, 
  syncCatalogToCloud, 
  fetchCatalogFromCloud,
  testFirestoreConnection,
  LocalUser
} from '../lib/storage';
import { Project, CatalogItem } from '../types';

interface StorageContextType {
  user: LocalUser | null;
  loading: boolean;
  isSyncing: boolean;
  cloudConnected: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  syncData: (projects: Project[], catalog: CatalogItem[]) => Promise<void>;
  loadCloudData: () => Promise<{ projects: Project[]; catalog: CatalogItem[] } | null>;
}

const StorageContext = createContext<StorageContextType | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudConnected, setCloudConnected] = useState<boolean>(true);

  useEffect(() => {
    testFirestoreConnection().then((ok) => setCloudConnected(ok));

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Failed to authenticate:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Failed to log out:', error);
      throw error;
    }
  };

  const syncData = async (projects: Project[], catalog: CatalogItem[]) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        syncProjectsToCloud(user.uid, projects),
        syncCatalogToCloud(user.uid, catalog),
      ]);
    } catch (error) {
      console.error('Local sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadCloudData = async (): Promise<{ projects: Project[]; catalog: CatalogItem[] } | null> => {
    if (!user) return null;
    setIsSyncing(true);
    try {
      const [cloudProjects, cloudCatalog] = await Promise.all([
        fetchProjectsFromCloud(user.uid),
        fetchCatalogFromCloud(user.uid),
      ]);
      return {
        projects: cloudProjects,
        catalog: cloudCatalog,
      };
    } catch (error) {
      console.error('Failed to load storage data:', error);
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <StorageContext.Provider
      value={{
        user,
        loading,
        isSyncing,
        cloudConnected,
        login,
        logout,
        syncData,
        loadCloudData,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
}

// Aliases for compatibility
export const useFirebase = useStorage;
export const FirebaseProvider = StorageProvider;

