import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { buildFirebaseSessionUser, mapFirebaseAuthError } from '../utils/authFallback.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function syncFirebaseUserProfile(firebaseUser) {
  if (!firebaseUser || !firebaseUser.emailVerified) return null;

  const uid = firebaseUser.uid;
  const userDocPath = `users/${uid}`;
  const privateDocPath = `users/${uid}/private/info`;
  let profileData = null;

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    const isBootstrapAdmin =
      firebaseUser.email?.toLowerCase() === 'habibalmulki2006@gmail.com';
    const safeDisplayName = String(
      firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pengguna Google'
    )
      .trim()
      .slice(0, 100);

    if (!snap.exists()) {
      const initialRole = isBootstrapAdmin ? 'admin' : 'user';
      await setDoc(userRef, {
        uid,
        displayName: safeDisplayName,
        role: initialRole,
        provider: 'google',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      profileData = { displayName: safeDisplayName, role: initialRole };
    } else {
      const existingData = snap.data();
      const nextRole = isBootstrapAdmin ? 'admin' : existingData.role;
      const updatePayload = {
        ...existingData,
        displayName: safeDisplayName || existingData.displayName,
        role: nextRole,
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, updatePayload, { merge: true });
      profileData = { displayName: updatePayload.displayName, role: nextRole };
    }

    if (firebaseUser.email) {
      await setDoc(doc(db, 'users', uid, 'private', 'info'), {
        uid,
        email: firebaseUser.email,
        updatedAt: serverTimestamp(),
      });
    }

    return buildFirebaseSessionUser(firebaseUser, profileData);
  } catch (error) {
    const targetPath = error instanceof Error && error.message.includes('private')
      ? privateDocPath
      : userDocPath;
    handleFirestoreError(error, OperationType.WRITE, targetPath);
    return null;
  }
}

export async function signInWithGooglePopup() {
  let credential;
  try {
    credential = await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    throw new Error(mapFirebaseAuthError(error, hostname, firebaseConfig.projectId));
  }

  let profile = null;
  try {
    profile = await syncFirebaseUserProfile(credential.user);
  } catch {
    profile = buildFirebaseSessionUser(credential.user);
  }

  const idToken = await credential.user.getIdToken();
  return {
    firebaseUser: credential.user,
    idToken,
    profile: profile || buildFirebaseSessionUser(credential.user),
  };
}

export async function signOutFirebase() {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export function subscribeFirebaseOrders(user, onData) {
  if (!auth.currentUser || !user) return () => {};
  const path = 'orders';
  const ordersQuery =
    user.role === 'admin' || user.role === 'operator'
      ? query(collection(db, 'orders'))
      : query(collection(db, 'orders'), where('buyerId', '==', auth.currentUser.uid));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => d.data());
      if (typeof onData === 'function') onData(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function initFirebaseAuthObserver(callback) {
  return onAuthStateChanged(auth, callback);
}
