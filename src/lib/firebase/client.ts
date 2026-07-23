import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

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
let _initialized = false;

function ensureInitialized() {
	if (_initialized) return true;
	if (!hasFirebaseConfig()) {
		if (import.meta.env.DEV) {
			console.info('[firebase] Firebase not configured — auth disabled');
		}
		return false;
	}
	if (!app) {
		if (!getApps().length) {
			app = initializeApp(firebaseConfig);
		} else {
			app = getApps()[0];
		}
	}
	_initialized = true;
	return true;
}

export function getFirebaseApp(): FirebaseApp | null {
	return ensureInitialized() ? app : null;
}

export function getFirebaseAuth(): Auth | null {
	if (!ensureInitialized()) return null;
	if (!auth) {
		const fbApp = getFirebaseApp();
		if (fbApp) auth = getAuth(fbApp);
	}
	return auth;
}

export function getFirestoreDb(): Firestore | null {
	if (!ensureInitialized()) return null;
	if (!db) {
		const fbApp = getFirebaseApp();
		if (fbApp) db = getFirestore(fbApp);
	}
	return db;
}
