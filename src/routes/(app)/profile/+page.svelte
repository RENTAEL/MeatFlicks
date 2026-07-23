<script lang="ts">
	import { page } from '$app/state';
	import { authStore } from '$lib/state/stores/authStore.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { User, Mail, Calendar, Shield, LogOut, ArrowLeft, Loader2, Save } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { updateProfile, sendPasswordResetEmail, type User as FirebaseUser } from 'firebase/auth';
	import { getFirebaseAuth } from '$lib/firebase/client';
	import { SEOHead } from '$lib/components/seo';

	let displayNameInput = $state('');
	let isSaving = $state(false);
	let saveMsg = $state<string | null>(null);
	let resetSent = $state(false);

	const user = $derived(authStore.state.user);

	$effect(() => {
		if (user?.displayName) displayNameInput = user.displayName;
	});

	async function handleSaveProfile() {
		if (!user) return;
		isSaving = true;
		saveMsg = null;
		try {
			await updateProfile(user, { displayName: displayNameInput || null });
			saveMsg = 'Profile updated!';
		} catch (e) {
			saveMsg = 'Failed to update profile.';
		} finally {
			isSaving = false;
		}
	}

	async function handleResetPassword() {
		if (!user?.email) return;
		try {
			await sendPasswordResetEmail(getFirebaseAuth(), user.email);
			resetSent = true;
		} catch (e) {
			console.error(e);
		}
	}

	function formatDate(ms: string | number | undefined | null) {
		if (!ms) return 'Unknown';
		return new Date(ms).toLocaleDateString();
	}
</script>

<SEOHead title="Profile - Streamium" description="Manage your Streamium profile and settings" noindex />

<div class="page-transition min-h-screen text-foreground">
	<main class="mx-auto max-w-2xl px-4 py-8">
		<button class="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors" onclick={() => goto('/')}>
			<ArrowLeft class="size-4" />
			Back
		</button>

		{#if !user}
			<div class="glass-strong rounded-2xl p-12 text-center">
				<User class="mx-auto size-16 text-muted-foreground" />
				<h1 class="mt-4 text-2xl font-bold text-foreground">Not Signed In</h1>
				<p class="mt-2 text-muted-foreground">Sign in to manage your profile and sync your data.</p>
				<Button class="mt-6" onclick={() => goto('/')}>Go Home</Button>
			</div>
		{:else}
			<h1 class="mb-8 text-3xl font-bold text-foreground">Profile</h1>

			<div class="glass-strong space-y-6 rounded-2xl p-8">
				<div class="flex items-center gap-4">
					<div class="flex size-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
						{(user.displayName || user.email || 'U')[0].toUpperCase()}
					</div>
					<div>
						<h2 class="text-xl font-semibold text-foreground">{user.displayName || 'User'}</h2>
						<p class="text-sm text-muted-foreground">{user.email}</p>
					</div>
				</div>

				<Separator />

				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">Account Info</h3>
					<div class="space-y-3 text-sm">
						<div class="flex items-center gap-3">
							<Mail class="size-4 text-muted-foreground" />
							<span class="text-foreground">{user.email}</span>
						</div>
						<div class="flex items-center gap-3">
							<Calendar class="size-4 text-muted-foreground" />
							<span class="text-foreground">Joined {formatDate((user.metadata as any)?.createdAt)}</span>
						</div>
						<div class="flex items-center gap-3">
							<Shield class="size-4 text-muted-foreground" />
							<span class="text-foreground">{user.emailVerified ? 'Email verified' : 'Email not verified'}</span>
						</div>
					</div>
				</div>

				<Separator />

				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">Display Name</h3>
					<input
						type="text"
						bind:value={displayNameInput}
						placeholder="Your display name"
						class="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
					/>
					<div class="flex items-center gap-3">
						<Button onclick={handleSaveProfile} disabled={isSaving} class="gap-2">
							{#if isSaving}<Loader2 class="size-4 animate-spin" />{/if}
							<Save class="size-4" />
							Save
						</Button>
						{#if saveMsg}
							<span class="text-sm text-muted-foreground">{saveMsg}</span>
						{/if}
					</div>
				</div>

				<Separator />

				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">Security</h3>
					<Button variant="outline" onclick={handleResetPassword} disabled={resetSent} class="gap-2">
						{resetSent ? 'Reset link sent!' : 'Reset Password'}
					</Button>
				</div>

				<Separator />

				<Button variant="destructive" onclick={() => authStore.logout()} class="gap-2 w-full">
					<LogOut class="size-4" />
					Sign Out
				</Button>
			</div>
		{/if}
	</main>
</div>
