import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  syncProjectsToCloud, 
  fetchProjectsFromCloud, 
  syncCatalogToCloud, 
  fetchCatalogFromCloud,
  testFirestoreConnection
} from '../lib/firebase';
import { Project, CatalogItem } from '../types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  isSyncing: boolean;
  cloudConnected: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  syncData: (projects: Project[], catalog: CatalogItem[]) => Promise<void>;
  loadCloudData: () => Promise<{ projects: Project[]; catalog: CatalogItem[] } | null>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudConnected, setCloudConnected] = useState<boolean>(false);

  useEffect(() => {
    // Check connection
    testFirestoreConnection().then((ok) => setCloudConnected(ok));

    // Listen for auth changes
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
      console.error('Failed to log in with Google:', error);
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
      console.error('Cloud sync error:', error);
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
      console.error('Failed to load cloud data:', error);
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <FirebaseContext.Provider
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
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
