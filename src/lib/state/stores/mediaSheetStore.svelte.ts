import type { LibraryMedia } from '$lib/types/library';

type MediaSheetState = {
	open: boolean;
	movie: LibraryMedia | null;
};

export const mediaSheetStore = $state<MediaSheetState>({
	open: false,
	movie: null
});

export function openMediaSheet(movie: LibraryMedia) {
	mediaSheetStore.movie = movie;
	mediaSheetStore.open = true;
}

export function closeMediaSheet() {
	mediaSheetStore.open = false;
	mediaSheetStore.movie = null;
}
