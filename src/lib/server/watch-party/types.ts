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
}
