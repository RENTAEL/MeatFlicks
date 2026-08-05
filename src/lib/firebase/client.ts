import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
	apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
	authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
};

function hasFirebaseConfig(): boolean {
	return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

async function ensureInitialized(): Promise<boolean> {
	if (!hasFirebaseConfig()) {
		if (import.meta.env.DEV) {
			console.info('[firebase] Firebase not configured — auth disabled');
		}
		return false;
	}
	if (app) return true;
	const { initializeApp, getApps } = await import('firebase/app');
	if (getApps().length) {
		app = getApps()[0];
	} else {
		app = initializeApp(firebaseConfig);
	}
	return true;
}

export async function getFirebaseApp(): Promise<FirebaseApp | null> {
	return (await ensureInitialized()) ? app : null;
}

export async function getFirebaseAuth(): Promise<Auth | null> {
	if (!(await ensureInitialized())) return null;
	if (!auth) {
		const { getAuth } = await import('firebase/auth');
		const fbApp = await getFirebaseApp();
		if (fbApp) auth = getAuth(fbApp);
	}
	return auth;
}

export async function getFirestoreDb(): Promise<Firestore | null> {
	if (!(await ensureInitialized())) return null;
	if (!db) {
		const { getFirestore } = await import('firebase/firestore');
		const fbApp = await getFirebaseApp();
		if (fbApp) db = getFirestore(fbApp);
	}
	return db;
}