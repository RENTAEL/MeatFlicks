export interface RoomUser {
	id: string;
	username: string;
}

export type MediaTarget = {
	title: string;
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season?: number;
	episode?: number;
};

export interface PlaybackCommand {
	action: 'play' | 'pause' | 'seek' | 'heartbeat';
	position?: number;
	provider?: { id: string; name: string } | null;
}

export type SoundEffect = 'suspense' | 'jump' | 'applause' | 'boo';

export interface RoomMedia {
	title: string;
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season?: number;
	episode?: number;
}

export interface RoomParticipant {
	userId: string;
	username: string;
	lastSeenAt: number;
	joinedAt: number;
	canControlSounds: boolean;
}

export interface RoomMessage {
	id: number;
	userId: string;
	username: string;
	body: string;
	deleted: boolean;
	createdAt: number;
}

export interface RoomPlayback {
	playing: boolean;
	position: number;
	positionAt: number;
	seq: number;
	provider: { id: string; name: string } | null;
}

export interface RoomKick {
	by: string;
	at: number;
}

export interface RoomQueueItem {
	id: number;
	position: number;
	title: string;
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season?: number;
	episode?: number;
	provider: { id: string; name: string } | null;
	addedBy: string;
	addedAt: number;
}

export interface RoomState {
	closed: boolean;
	roomId: string;
	host: { userId: string; username: string };
	isHost: boolean;
	isMember: boolean;
	media: RoomMedia | null;
	playback: RoomPlayback;
	sound: { effect: SoundEffect; seq: number } | null;
	participants: RoomParticipant[];
	lastMessageId: number;
	messages: RoomMessage[];
	queue: RoomQueueItem[];
	kicked: RoomKick | null;
}
