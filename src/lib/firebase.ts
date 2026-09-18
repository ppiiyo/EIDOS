import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
// Standalone configuration (no external cloud lock-in, 100% self-contained)
const firebaseConfig = {
  projectId: "ai-studio-eidossemanticide-11612d96-0da5-44b6-bd0b-e41585cc7df2",
  firestoreDatabaseId: "ai-studio-eidossemanticide-11612d96-0da5-44b6-bd0b-e41585cc7df2",
  apiKey: "demo-key",
  authDomain: "localhost",
};
import { Project, CatalogItem } from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific databaseId (required by AI Studio Firebase setup)
// Using experimentalForceLongPolling to prevent WebChannel streaming timeouts in sandboxed iframes & preview proxies
let dbInstance;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = dbInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Operation types for error reporting
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const checkPromise = getDocFromServer(doc(db, 'test', 'connection'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('the client is offline')), 4000)
    );
    await Promise.race([checkPromise, timeoutPromise]);
    return true;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('the client is offline') ||
      error.message.includes('Could not reach Cloud Firestore backend') ||
      error.message.includes('unavailable')
    )) {
      console.warn('Firestore is offline or unreachable. Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on test/connection is expected if rules deny it, but proves connectivity to server
    return true;
  }
}

// User Auth Operations
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      // Sync user profile to Firestore
      const userRef = doc(db, 'users', user.uid);
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          tier: 'business',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }
    }
    return user;
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Cloud sync: Projects
export async function syncProjectsToCloud(userId: string, projects: Project[]): Promise<void> {
  for (const project of projects) {
    const docPath = `users/${userId}/projects/${project.id}`;
    try {
      await setDoc(doc(db, 'users', userId, 'projects', project.id), {
        id: project.id,
        name: project.name,
        simThreshold: project.simThreshold ?? 0.25,
        concepts: project.concepts,
        userId: userId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }
}

export async function fetchProjectsFromCloud(userId: string): Promise<Project[]> {
  const collectionPath = `users/${userId}/projects`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'projects'));
    const projects: Project[] = [];
    snap.forEach((d) => {
      const data = d.data();
      projects.push({
        id: data.id || d.id,
        name: data.name || 'Untitled Project',
        simThreshold: typeof data.simThreshold === 'number' ? data.simThreshold : 0.25,
        concepts: Array.isArray(data.concepts) ? data.concepts : [],
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
      });
    });
    return projects;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionPath);
  }
}

// Cloud sync: Catalog items
export async function syncCatalogToCloud(userId: string, catalog: CatalogItem[]): Promise<void> {
  for (const item of catalog) {
    const itemIdStr = String(item.id);
    const docPath = `users/${userId}/catalog/${itemIdStr}`;
    try {
      await setDoc(doc(db, 'users', userId, 'catalog', itemIdStr), {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price: item.price || '',
        rating: item.rating ?? 4.5,
        reviews: item.reviews ?? 10,
        badge: item.badge || '',
        tags: item.tags || [],
        icon: item.icon || '📦',
        custom: !!item.custom,
        userId: userId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }
}

export async function fetchCatalogFromCloud(userId: string): Promise<CatalogItem[]> {
  const collectionPath = `users/${userId}/catalog`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'catalog'));
    const catalog: CatalogItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      catalog.push({
        id: Number(data.id) || Number(d.id) || Date.now(),
        title: data.title || '',
        description: data.description || '',
        category: data.category || 'Общее',
        price: data.price,
        rating: data.rating,
        reviews: data.reviews,
        badge: data.badge,
        tags: Array.isArray(data.tags) ? data.tags : [],
        icon: data.icon || '📦',
        custom: !!data.custom,
      });
    });
    return catalog;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionPath);
  }
}
