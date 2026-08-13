import { browser } from '$app/environment';
import type { User } from 'firebase/auth';
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

	async function init() {
		if (!browser) return;
		const auth = await getFirebaseAuth();
		if (!auth) {
			state.isLoading = false;
			return;
		}
		const { onAuthStateChanged } = await import('firebase/auth');
		unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
			console.log('auth user:', firebaseUser?.displayName, firebaseUser?.email);
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
		const auth = await getFirebaseAuth();
		if (!auth) throw new Error('Firebase not configured');
		const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
		const cred = await createUserWithEmailAndPassword(auth, email, password);
		if (displayName) {
			await updateProfile(cred.user, { displayName });
		}
		await migrateLocalData(cred.user.uid);
		return cred.user;
	}

	async function login(email: string, password: string) {
		const auth = await getFirebaseAuth();
		if (!auth) throw new Error('Firebase not configured');
		const { signInWithEmailAndPassword } = await import('firebase/auth');
		const cred = await signInWithEmailAndPassword(auth, email, password);
		await migrateLocalData(cred.user.uid);
		return cred.user;
	}

	async function logout() {
		const auth = await getFirebaseAuth();
		if (!auth) return;
		const { signOut } = await import('firebase/auth');
		await signOut(auth);
		state.user = null;
		state.isGuest = true;
	}

	async function resetPassword(email: string) {
		const auth = await getFirebaseAuth();
		if (!auth) throw new Error('Firebase not configured');
		const { sendPasswordResetEmail } = await import('firebase/auth');
		await sendPasswordResetEmail(auth, email);
	}

	async function migrateLocalData(uid: string) {
		try {
			const db = await getFirestoreDb();
			if (!db) return;
			const { doc, collection, writeBatch, getDoc } = await import('firebase/firestore');
			const userDoc = doc(db, 'users', uid);
			const existing = await getDoc(userDoc);
			if (existing.exists()) return;

			const localHistory = (watchHistory as any).exportData
				? (watchHistory as any).exportData()
				: [];
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
			const db = await getFirestoreDb();
			if (!db) return;

			const { collection, getDocs } = await import('firebase/firestore');

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
			const db = await getFirestoreDb();
			if (!db) return;
			const { doc, setDoc } = await import('firebase/firestore');
			await setDoc(doc(db, 'users', state.user.uid, 'progress', mediaId), data, { merge: true });
		} catch (e) {
			console.error('[auth] Failed to save progress to cloud:', e);
		}
	}

	async function saveWatchlistToCloud(item: any) {
		if (state.isGuest || !state.user) return;
		try {
			const db = await getFirestoreDb();
			if (!db) return;
			const { doc, setDoc } = await import('firebase/firestore');
			await setDoc(doc(db, 'users', state.user.uid, 'watchlist', String(item.id)), item, {
				merge: true
			});
		} catch (e) {
			console.error('[auth] Failed to save watchlist to cloud:', e);
		}
	}

	async function removeWatchlistFromCloud(mediaId: string) {
		if (state.isGuest || !state.user) return;
		try {
			const db = await getFirestoreDb();
			if (!db) return;
			const { doc, deleteDoc } = await import('firebase/firestore');
			await deleteDoc(doc(db, 'users', state.user.uid, 'watchlist', mediaId));
		} catch (e) {
			console.error('[auth] Failed to remove watchlist from cloud:', e);
		}
	}

	return {
		get state() {
			return state;
		},
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
