import { browser } from '$app/environment';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	sendPasswordResetEmail,
	updateProfile,
	type User
} from 'firebase/auth';
import {
	doc,
	setDoc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
	deleteDoc,
	writeBatch
} from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from '$lib/firebase/client';
import { watchHistory } from './historyStore';
import { watchlist } from './watchlistStore.svelte';
import { playbackStore } from './playbackStore.svelte';

export type AuthState = {
	user: User | null;
	isLoading: boolean;
	isGuest: boolean;
};

function createAuthStore() {
	let state = $state<AuthState>({
		user: null,
		isLoading: true,
		isGuest: true
	});

	let unsubscribe: (() => void) | null = null;

	function init() {
		if (!browser) return;
		const auth = getFirebaseAuth();
		if (!auth) {
			state.isLoading = false;
			return;
		}
		unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
			state.isLoading = true;
			if (firebaseUser) {
				state.user = firebaseUser;
				state.isGuest = false;
				await syncFromCloud(firebaseUser.uid);
			} else {
				state.user = null;
				state.isGuest = true;
			}
			state.isLoading = false;
		});
	}

	function cleanup() {
		unsubscribe?.();
	}

	async function signup(email: string, password: string, displayName?: string) {
		const auth = getFirebaseAuth();
		if (!auth) throw new Error('Firebase not configured');
		const cred = await createUserWithEmailAndPassword(auth, email, password);
		if (displayName) {
			await updateProfile(cred.user, { displayName });
		}
		await migrateLocalData(cred.user.uid);
		return cred.user;
	}

	async function login(email: string, password: string) {
		const auth = getFirebaseAuth();
		if (!auth) throw new Error('Firebase not configured');
		const cred = await signInWithEmailAndPassword(auth, email, password);
		await migrateLocalData(cred.user.uid);
		return cred.user;
	}

	async function logout() {
		const auth = getFirebaseAuth();
		if (!auth) return;
		await signOut(auth);
		state.user = null;
		state.isGuest = true;
	}

	async function resetPassword(email: string) {
		const auth = getFirebaseAuth();
		if (!auth) throw new Error('Firebase not configured');
		await sendPasswordResetEmail(auth, email);
	}

	async function migrateLocalData(uid: string) {
		try {
			const db = getFirestoreDb();
			if (!db) return;
			const userDoc = doc(db, 'users', uid);
			const existing = await getDoc(userDoc);
			if (existing.exists()) return;

			const localHistory = (watchHistory as any).exportData ? (watchHistory as any).exportData() : [];
			const localWatchlist = (watchlist as any).getAll ? (watchlist as any).getAll() : [];
			const localProgress = (playbackStore as any).getAll ? (playbackStore as any).getAll() : {};

			const batch = writeBatch(db);

			if (localWatchlist.length > 0) {
				const watchlistRef = collection(db, 'users', uid, 'watchlist');
				for (const item of localWatchlist) {
					const itemDoc = doc(watchlistRef, String(item.id));
					batch.set(itemDoc, {
						...item,
						syncedAt: Date.now()
					});
				}
			}

			if (localProgress && Object.keys(localProgress).length > 0) {
				const progressRef = collection(db, 'users', uid, 'progress');
				for (const [key, val] of Object.entries(localProgress)) {
					const itemDoc = doc(progressRef, key);
					batch.set(itemDoc, val);
				}
			}

			if (localHistory.length > 0) {
				const historyRef = collection(db, 'users', uid, 'history');
				for (const item of localHistory) {
					const hDoc = doc(historyRef, String(item.id));
					batch.set(hDoc, {
						...item,
						syncedAt: Date.now()
					});
				}
			}

			await batch.commit();
		} catch (e) {
			console.error('[auth] Failed to migrate local data:', e);
		}
	}

	async function syncFromCloud(uid: string) {
		try {
			const db = getFirestoreDb();
			if (!db) return;

			const progressSnap = await getDocs(collection(db, 'users', uid, 'progress'));
			progressSnap.forEach((d) => {
				const data = d.data();
				if ((playbackStore as any).set) {
					(playbackStore as any).set(String(d.id), data);
				}
			});

			const watchlistSnap = await getDocs(collection(db, 'users', uid, 'watchlist'));
			watchlistSnap.forEach((d) => {
				watchlist.addToWatchlist(d.data() as any);
			});

			const historySnap = await getDocs(collection(db, 'users', uid, 'history'));
			historySnap.forEach((d) => {
				watchHistory.recordWatch(d.data() as any);
			});
		} catch (e) {
			console.error('[auth] Failed to sync from cloud:', e);
		}
	}

	async function saveProgressToCloud(mediaId: string, data: any) {
		if (state.isGuest || !state.user) return;
		try {
			const db = getFirestoreDb();
			await setDoc(doc(db, 'users', state.user.uid, 'progress', mediaId), data, { merge: true });
		} catch (e) {
			console.error('[auth] Failed to save progress to cloud:', e);
		}
	}

	async function saveWatchlistToCloud(item: any) {
		if (state.isGuest || !state.user) return;
		try {
			const db = getFirestoreDb();
			await setDoc(doc(db, 'users', state.user.uid, 'watchlist', String(item.id)), item, { merge: true });
		} catch (e) {
			console.error('[auth] Failed to save watchlist to cloud:', e);
		}
	}

	async function removeWatchlistFromCloud(mediaId: string) {
		if (state.isGuest || !state.user) return;
		try {
			const db = getFirestoreDb();
			await deleteDoc(doc(db, 'users', state.user.uid, 'watchlist', mediaId));
		} catch (e) {
			console.error('[auth] Failed to remove watchlist from cloud:', e);
		}
	}

	return {
		get state() { return state; },
		init,
		cleanup,
		signup,
		login,
		logout,
		resetPassword,
		migrateLocalData,
		saveProgressToCloud,
		saveWatchlistToCloud,
		removeWatchlistFromCloud
	};
}

export const authStore = createAuthStore();
