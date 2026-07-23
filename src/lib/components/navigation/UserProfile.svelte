<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import * as Avatar from '$lib/components/ui/avatar';
	import { SidebarMenuButton } from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { History, Bookmark, Settings, LogIn, LogOut, User } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/state/stores/authStore.svelte';
	import AuthModal from '$lib/components/auth/AuthModal.svelte';

	let { onOpenSettings } = $props<{ onOpenSettings: () => void }>();

	let showAuthModal = $state(false);

	const currentUser = $derived(authStore.state.user);
	const isLoggedIn = $derived(Boolean(currentUser));
	const displayName = $derived(currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User');
	const avatarUrl = $derived(currentUser?.photoURL || `https://api.dicebear.com/9.x/avataaars/svg?seed=${currentUser?.email || 'guest'}`);

	async function handleNavigate(path: string) {
		await goto(path.startsWith('/') ? path : `/${path}`);
	}
</script>

<AuthModal open={showAuthModal} onClose={() => (showAuthModal = false)} />

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<SidebarMenuButton
				{...props}
				class="h-12 w-12 overflow-hidden rounded-full p-0 hover:bg-transparent data-[state=open]:bg-transparent"
			>
				<Avatar.Root class="h-12 w-12 cursor-pointer transition-transform hover:scale-105">
					<Avatar.Image src={avatarUrl} alt={displayName} />
					<Avatar.Fallback>
						<User class="size-5" />
					</Avatar.Fallback>
				</Avatar.Root>
			</SidebarMenuButton>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content side="right" align="end" class="w-56 p-2">
		<div class="mb-2 flex items-center gap-2 p-2">
			<Avatar.Root class="h-8 w-8">
				<Avatar.Image src={avatarUrl} alt={displayName} />
				<Avatar.Fallback>U</Avatar.Fallback>
			</Avatar.Root>
			<div class="flex flex-col">
				<span class="text-sm font-medium">{displayName}</span>
				{#if isLoggedIn}
					<span class="text-xs text-muted-foreground">Signed in</span>
				{:else}
					<span class="text-xs text-muted-foreground">Sign in to sync</span>
				{/if}
			</div>
		</div>

		{#if isLoggedIn}
			<Button variant="ghost" class="mb-1 w-full justify-start" size="sm" onclick={() => handleNavigate('/profile')}>
				<User class="mr-2 h-4 w-4" />
				Profile
			</Button>
		{/if}

		{#if !isLoggedIn}
			<Button
				variant="default"
				class="mb-2 w-full justify-start"
				size="sm"
				onclick={() => (showAuthModal = true)}
			>
				<LogIn class="mr-2 h-4 w-4" />
				Sign In
			</Button>
		{:else}
			<Button variant="ghost" class="mb-2 w-full justify-start" size="sm" onclick={() => authStore.logout()}>
				<LogOut class="mr-2 h-4 w-4" />
				Sign Out
			</Button>
		{/if}
		<Separator class="my-2" />

		<div class="grid gap-1">
			<Button variant="ghost" class="w-full justify-start text-foreground" size="sm" onclick={() => handleNavigate('/history')}>
				<History class="mr-2 h-4 w-4" />
				History
			</Button>
			<Button variant="ghost" class="w-full justify-start text-foreground" size="sm" onclick={() => handleNavigate('/watchlist')}>
				<Bookmark class="mr-2 h-4 w-4" />
				Watchlist
			</Button>
			<Separator class="my-2" />
			<Button variant="ghost" class="w-full justify-start" size="sm" onclick={onOpenSettings}>
				<Settings class="mr-2 h-4 w-4 text-muted-foreground" />
				Settings
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>
