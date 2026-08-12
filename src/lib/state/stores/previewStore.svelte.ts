import type { PreviewBranding } from '$lib/utils/branding';

let preview = $state<PreviewBranding | null>(null);

export const previewStore = {
	get current() {
		return preview;
	},
	set(value: PreviewBranding | null) {
		preview = value;
	}
};
