export type PopoutPreviewState = {
	anchorEl: HTMLElement | null;
	src: string | null;
	title: string;
};

export const popoutPreviewStore = $state<PopoutPreviewState>({
	anchorEl: null,
	src: null,
	title: ''
});

export function openPopout(anchorEl: HTMLElement, src: string, title: string) {
	popoutPreviewStore.anchorEl = anchorEl;
	popoutPreviewStore.src = src;
	popoutPreviewStore.title = title;
}

export function closePopout() {
	popoutPreviewStore.anchorEl = null;
	popoutPreviewStore.src = null;
	popoutPreviewStore.title = '';
}
