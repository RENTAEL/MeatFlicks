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

export type PopoutPreviewState = {
	anchorEl: HTMLElement | null;
	src: string | null;
	title: string;
	rating: string | null;
	year: string | null;
	genres: string[];
	overview: string | null;
};

export const popoutPreviewStore = $state<PopoutPreviewState>({
	anchorEl: null,
	src: null,
	title: '',
	rating: null,
	year: null,
	genres: [],
	overview: null
});

export function openPopout(
	anchorEl: HTMLElement, 
	src: string, 
	title: string, 
	metadata: Partial<PopoutPreviewState> = {}
) {
	popoutPreviewStore.anchorEl = anchorEl;
	popoutPreviewStore.src = src;
	popoutPreviewStore.title = title;
	popoutPreviewStore.rating = metadata.rating ?? null;
	popoutPreviewStore.year = metadata.year ?? null;
	popoutPreviewStore.genres = metadata.genres ?? [];
	popoutPreviewStore.overview = metadata.overview ?? null;
}

export function closePopout() {
	popoutPreviewStore.anchorEl = null;
	popoutPreviewStore.src = null;
	popoutPreviewStore.title = '';
	popoutPreviewStore.rating = null;
	popoutPreviewStore.year = null;
	popoutPreviewStore.genres = [];
	popoutPreviewStore.overview = null;
}
