<script lang="ts">
	import { X, Mail, Lock, User, Loader2, Eye, EyeOff, AlertCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { authStore } from '$lib/state/stores/authStore.svelte';
	import { FirebaseError } from 'firebase/app';

	let { open = false, onClose }: { open?: boolean; onClose: () => void } = $props();

	let mode = $state<'login' | 'signup' | 'reset'>('login');
	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let showPassword = $state(false);
	let error = $state<string | null>(null);
	let isLoading = $state(false);
	let resetSent = $state(false);

	function resetForm() {
		email = '';
		password = '';
		displayName = '';
		error = null;
		isLoading = false;
		resetSent = false;
	}

	function handleClose() {
		resetForm();
		onClose();
	}

	async function handleSubmit() {
		error = null;
		isLoading = true;

		try {
			if (mode === 'login') {
				await authStore.login(email, password);
			} else if (mode === 'signup') {
				await authStore.signup(email, password, displayName || undefined);
			} else if (mode === 'reset') {
				await authStore.resetPassword(email);
				resetSent = true;
			}
			if (mode !== 'reset') handleClose();
		} catch (e) {
			if (e instanceof FirebaseError) {
				const messages: Record<string, string> = {
					'auth/user-not-found': 'No account found with this email.',
					'auth/wrong-password': 'Incorrect password.',
					'auth/invalid-credential': 'Invalid email or password.',
					'auth/email-already-in-use': 'An account with this email already exists.',
					'auth/weak-password': 'Password must be at least 6 characters.',
					'auth/invalid-email': 'Please enter a valid email address.',
					'auth/too-many-requests': 'Too many attempts. Please try again later.'
				};
				error = messages[e.code] || e.message;
			} else {
				error = e instanceof Error ? e.message : 'Something went wrong.';
			}
		} finally {
			isLoading = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label={mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
		onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
		onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}
	>
		<div class="glass-strong animate-scale-in relative w-full max-w-md rounded-2xl p-8 shadow-2xl">
			<button
				type="button"
				class="absolute top-4 right-4 text-muted-foreground transition-colors hover:text-foreground"
				onclick={handleClose}
				aria-label="Close"
			>
				<X class="size-5" />
			</button>

			<div class="mb-6 text-center">
				<h2 class="text-2xl font-bold text-foreground">
					{mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join Streamium' : 'Reset Password'}
				</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					{mode === 'login'
						? 'Sign in to sync your library across devices.'
						: mode === 'signup'
							? 'Create an account to save your progress.'
							: 'Enter your email to receive a reset link.'}
				</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
				{#if mode === 'signup'}
					<div class="relative">
						<User class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							placeholder="Display name"
							bind:value={displayName}
							class="glass w-full rounded-lg py-2.5 pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
						/>
					</div>
				{/if}

				<div class="relative">
					<Mail class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="email"
						placeholder="Email"
						bind:value={email}
						required
						autocomplete="email"
						class="glass w-full rounded-lg py-2.5 pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
					/>
				</div>

				{#if mode !== 'reset'}
					<div class="relative">
						<Lock class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type={showPassword ? 'text' : 'password'}
							placeholder="Password"
							bind:value={password}
							required
							minlength={6}
							autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
							class="glass w-full rounded-lg py-2.5 pr-10 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
						/>
						<button
							type="button"
							class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOff class="size-4" />
							{:else}
								<Eye class="size-4" />
							{/if}
						</button>
					</div>
				{/if}

				{#if error}
					<div class="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
						<AlertCircle class="size-4 shrink-0" />
						{error}
					</div>
				{/if}

				{#if resetSent}
					<div class="rounded-lg bg-primary/10 p-3 text-sm text-primary">
						Reset link sent! Check your email.
					</div>
				{/if}

				<Button
					type="submit"
					class="w-full gap-2"
					disabled={isLoading || resetSent}
				>
					{#if isLoading}
						<Loader2 class="size-4 animate-spin" />
					{/if}
					{mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
				</Button>
			</form>

			<div class="mt-6 space-y-2 text-center text-sm text-muted-foreground">
				{#if mode === 'login'}
					<button type="button" class="hover:text-primary transition-colors" onclick={() => { mode = 'reset'; resetForm(); }}>
						Forgot password?
					</button>
					<div>
						Don't have an account?{' '}
						<button type="button" class="text-primary hover:underline" onclick={() => { mode = 'signup'; resetForm(); }}>
							Sign up
						</button>
					</div>
				{:else if mode === 'signup'}
					<div>
						Already have an account?{' '}
						<button type="button" class="text-primary hover:underline" onclick={() => { mode = 'login'; resetForm(); }}>
							Sign in
						</button>
					</div>
				{:else}
					<button type="button" class="text-primary hover:underline" onclick={() => { mode = 'login'; resetForm(); }}>
						Back to sign in
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
