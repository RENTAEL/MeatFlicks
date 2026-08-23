/**
 * Streamium Watch Party backend — Cloudflare Workers + Durable Objects.
 *
 * One RoomDO per room (idFromName of the 6-char room code). Mirrors the
 * original Vercel REST + SSE contract exactly so the frontend only swaps
 * its base URL. Real-time fanout is in-memory inside the DO (no polling);
 * state is persisted to DO SQLite storage so rooms survive eviction.
 *
 * Identity: the frontend sends `u` (user id) + `n` (username) per request.
 * This is trust-the-client by design for v1 — see README.
 */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_MESSAGE_LENGTH = 240;
const MEMBER_TIMEOUT_MS = 120_000;
const ROOM_TTL_MS = 30 * 60_000; // idle lifetime before the alarm closes the room

type Participant = {
	username: string;
	joinedAt: number;
	lastSeenAt: number;
	canControlSounds: boolean;
};

type Message = {
	id: number;
	userId: string;
	username: string;
	body: string;
	deleted: boolean;
	deletedAt: number | null;
	createdAt: number;
};

type QueueItem = {
	id: number;
	position: number;
	title: string;
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season: number | null;
	episode: number | null;
	providerId: string | null;
	providerName: string | null;
	addedBy: string;
	addedAt: number;
};

type RoomState = {
	code: string;
	hostUserId: string;
	hostUsername: string;
	title: string;
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season: number | null;
	episode: number | null;
	playing: boolean;
	position: number;
	positionAt: number;
	seq: number;
	providerId: string | null;
	providerName: string | null;
	soundEffect: string | null;
	soundSeq: number;
	kickedUserId: string | null;
	kickedByUsername: string | null;
	kickedAt: number | null;
	lastMessageId: number;
	lastActivityAt: number;
	closed: boolean;
	participants: Record<string, Participant>;
	messages: Message[];
	queue: QueueItem[];
};

interface Env {
	ROOM: DurableObjectNamespace;
	ALLOWED_ORIGINS: string;
	MAX_ROOM_LIFETIME_MS: string;
}

function code(): string {
	let out = '';
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	return out;
}

function cors(origin: string | null, env: Env): Record<string, string> {
	const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim());
	const headers: Record<string, string> = {
		'access-control-allow-methods': 'GET,POST,OPTIONS',
		'access-control-allow-headers': 'content-type'
	};
	if (origin && allowed.includes(origin)) {
		headers['access-control-allow-origin'] = origin;
	}
	return headers;
}

const json = (data: unknown, env: Env, origin: string | null, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', ...cors(origin, env) }
	});

export class RoomDO {
	state: DurableObjectState;
	env: Env;
	room: RoomState | null = null;
	loaded = false;
	writers = new Set<{ userId: string; since: number; writer: WritableStreamDefaultWriter }>();
	msgId = 0;
	queueId = 0;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async load(): Promise<RoomState> {
		if (this.loaded && this.room) return this.room;
		const stored = (await this.state.storage.get<RoomState>('room')) ?? null;
		this.room =
			stored ??
			({
				code: this.state.id.name ?? code(),
				hostUserId: '',
				hostUsername: '',
				title: 'Watch Party',
				mediaType: 'movie',
				tmdbId: 0,
				season: null,
				episode: null,
				playing: false,
				position: 0,
				positionAt: 0,
				seq: 0,
				providerId: null,
				providerName: null,
				soundEffect: null,
				soundSeq: 0,
				kickedUserId: null,
				kickedByUsername: null,
				kickedAt: null,
				lastMessageId: 0,
				lastActivityAt: Date.now(),
				closed: false,
				participants: {},
				messages: [],
				queue: []
			} as RoomState);
		this.msgId = this.room.messages.reduce((m, x) => Math.max(m, x.id), 0);
		this.queueId = this.room.queue.reduce((m, x) => Math.max(m, x.id), 0);
		this.loaded = true;
		return this.room;
	}

	async save(): Promise<void> {
		if (!this.room) return;
		this.room.lastActivityAt = Date.now();
		await this.state.storage.put('room', this.room);
		await this.state.storage.setAlarm(
			Date.now() + Number(this.env.MAX_ROOM_LIFETIME_MS || ROOM_TTL_MS)
		);
	}

	/** Idle-room cleanup: close + broadcast so clients see "party ended". */
	async alarm(): Promise<void> {
		const room = await this.load();
		if (room.closed) return;
		room.closed = true;
		await this.state.storage.put('room', room);
		this.broadcast();
	}

	async sweep(): Promise<void> {
		const room = await this.load();
		const now = Date.now();
		let changed = false;
		for (const [uid, p] of Object.entries(room.participants)) {
			if (now - p.lastSeenAt > MEMBER_TIMEOUT_MS) {
				delete room.participants[uid];
				changed = true;
			}
		}
		if (changed) {
			room.seq += 1;
			await this.save();
			this.broadcast();
		}
	}

	/** Personalized RoomState in the exact shape the frontend expects. */
	snapshot(userId: string, since: number): Record<string, unknown> {
		const r = this.room!;
		const isMember = !!r.participants[userId];
		const isHost = r.hostUserId === userId;
		if (r.closed) {
			return {
				closed: true,
				roomId: r.code,
				host: { userId: r.hostUserId, username: r.hostUsername },
				isHost,
				isMember: false,
				media: null,
				playback: { playing: false, position: 0, positionAt: 0, seq: r.seq, provider: null },
				sound: null,
				participants: [],
				lastMessageId: r.lastMessageId,
				messages: [],
				queue: [],
				kicked: null
			};
		}
		const messages = r.messages.filter(
			(m) => m.id > since || (m.deleted && m.deletedAt && m.deletedAt > now() - 60_000)
		);
		return {
			closed: false,
			roomId: r.code,
			host: { userId: r.hostUserId, username: r.hostUsername },
			isHost,
			isMember,
			media: {
				title: r.title,
				mediaType: r.mediaType,
				tmdbId: r.tmdbId,
				season: r.season ?? undefined,
				episode: r.episode ?? undefined
			},
			playback: {
				playing: r.playing,
				position: r.position,
				positionAt: r.positionAt,
				seq: r.seq,
				provider: r.providerId && r.providerName ? { id: r.providerId, name: r.providerName } : null
			},
			sound: r.soundEffect ? { effect: r.soundEffect, seq: r.soundSeq } : null,
			participants: Object.entries(r.participants)
				.map(([uid, p]) => ({
					userId: uid,
					username: p.username,
					lastSeenAt: p.lastSeenAt,
					joinedAt: p.joinedAt,
					canControlSounds: p.canControlSounds
				}))
				.sort((a, b) => a.joinedAt - b.joinedAt),
			lastMessageId: r.lastMessageId,
			messages,
			queue: r.queue,
			kicked:
				r.kickedUserId === userId && r.kickedAt
					? { by: r.kickedByUsername ?? 'the host', at: r.kickedAt }
					: null
		};
	}

	broadcast(): void {
		for (const w of this.writers) {
			try {
				const frame = `event: state\ndata: ${JSON.stringify(this.snapshot(w.userId, w.since))}\n\n`;
				w.writer.write(new TextEncoder().encode(frame));
			} catch {
				this.writers.delete(w);
			}
		}
	}

	async join(userId: string, username: string): Promise<void> {
		const r = await this.load();
		if (r.closed) return;
		const now = Date.now();
		const existing = r.participants[userId];
		r.participants[userId] = {
			username,
			joinedAt: existing?.joinedAt ?? now,
			lastSeenAt: now,
			canControlSounds: existing?.canControlSounds ?? false
		};
		if (r.kickedUserId === userId) {
			r.kickedUserId = null;
			r.kickedByUsername = null;
			r.kickedAt = null;
		}
		await this.save();
		this.broadcast();
	}

	async requireHost(userId: string): Promise<boolean> {
		const r = await this.load();
		return r.hostUserId === userId;
	}

	async handleRequest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const path = url.pathname;
		const userId = url.searchParams.get('u') ?? '';
		const username = (url.searchParams.get('n') ?? 'Guest').slice(0, 40);
		const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

		await this.load();
		// /init is the create handshake — allowed even on a closed room so a
		// fresh DO can always be initialized.
		if (this.room!.closed && path !== '/close' && path !== '/init') {
			return new Response(JSON.stringify({ closed: true }), { status: 410 });
		}

		// Create handshake: first caller becomes host; a second init on an
		// existing room returns 409 so the router retries with a new code.
		if (path === '/init' && req.method === 'POST') {
			if (this.room!.hostUserId) {
				return new Response('exists', { status: 409 });
			}
			this.room!.hostUserId = userId;
			this.room!.hostUsername = username;
			this.room!.title = String(body.title ?? 'Watch Party').slice(0, 120);
			this.room!.mediaType = body.mediaType === 'tv' ? 'tv' : 'movie';
			this.room!.tmdbId = Number(body.tmdbId ?? 0);
			this.room!.season = body.season ?? null;
			this.room!.episode = body.episode ?? null;
			this.room!.participants[userId] = {
				username,
				joinedAt: Date.now(),
				lastSeenAt: Date.now(),
				canControlSounds: false
			};
			await this.save();
			return new Response(JSON.stringify({ ok: true }));
		}

		// Join / leave
		if (path === '/join' && req.method === 'POST') {
			if (!userId) return new Response('bad request', { status: 400 });
			await this.join(userId, username);
			return new Response(JSON.stringify({ ok: true }));
		}
		if (path === '/leave' && req.method === 'POST') {
			const r = await this.load();
			delete r.participants[userId];
			if (r.hostUserId === userId) {
				r.closed = true;
				await this.save();
				this.broadcast();
				return new Response(JSON.stringify({ ok: true, closedRoom: true }));
			}
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true, closedRoom: false }));
		}

		// Snapshot
		if (path === '/state' && req.method === 'GET') {
			const r = await this.load();
			if (r.participants[userId]) r.participants[userId].lastSeenAt = Date.now();
			await this.sweep();
			return new Response(
				JSON.stringify(this.snapshot(userId, Number(url.searchParams.get('since') ?? 0)))
			);
		}

		// SSE stream — registers a personalized writer; broadcasts push frames.
		if (path === '/stream' && req.method === 'GET') {
			await this.join(userId, username);
			const since = Number(url.searchParams.get('since') ?? 0);
			const { readable, writable } = new TransformStream();
			const writer = writable.getWriter();
			const entry = { userId, since, writer };
			this.writers.add(entry);
			// initial frame
			writer.write(
				new TextEncoder().encode(
					`event: state\ndata: ${JSON.stringify(this.snapshot(userId, since))}\n\n`
				)
			);
			const ping = setInterval(() => {
				try {
					writer.write(new TextEncoder().encode(': ping\n\n'));
				} catch {}
			}, 15000);
			req.signal.addEventListener('abort', () => {
				clearInterval(ping);
				this.writers.delete(entry);
				try {
					writer.close();
				} catch {}
			});
			return new Response(readable, {
				headers: {
					'content-type': 'text/event-stream',
					'cache-control': 'no-cache, no-transform',
					connection: 'keep-alive'
				}
			});
		}

		// Playback (host only)
		if (path === '/playback' && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			const action = String(body.action ?? '');
			r.position = typeof body.position === 'number' ? body.position : r.position;
			r.playing = action === 'pause' ? false : action === 'play' ? true : r.playing;
			if (body.provider?.id) {
				r.providerId = body.provider.id;
				r.providerName = body.provider.name ?? body.provider.id;
			}
			r.positionAt = Date.now();
			r.seq += 1;
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true }));
		}

		// Chat
		if (path === '/messages' && req.method === 'POST') {
			const r = await this.load();
			if (!r.participants[userId]) return new Response('forbidden', { status: 403 });
			const text = String(body.body ?? '')
				.trim()
				.slice(0, MAX_MESSAGE_LENGTH);
			if (!text) return new Response('bad request', { status: 400 });
			const m: Message = {
				id: ++this.msgId,
				userId,
				username,
				body: text,
				deleted: false,
				deletedAt: null,
				createdAt: Date.now()
			};
			r.messages.push(m);
			if (r.messages.length > 200) r.messages.splice(0, r.messages.length - 200);
			r.lastMessageId = m.id;
			r.seq += 1;
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true }));
		}
		const delMsg = path.match(/^\/messages\/(\d+)\/delete$/);
		if (delMsg && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			const m = r.messages.find((x) => x.id === Number(delMsg[1]));
			if (m) {
				m.deleted = true;
				m.deletedAt = Date.now();
				r.seq += 1;
				await this.save();
				this.broadcast();
			}
			return new Response(JSON.stringify({ ok: true }));
		}

		// Kick (host only)
		if (path === '/kick' && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			const target = String(body.userId ?? '');
			if (target && target !== r.hostUserId) {
				delete r.participants[target];
				r.kickedUserId = target;
				r.kickedByUsername = username;
				r.kickedAt = Date.now();
				r.seq += 1;
				await this.save();
				this.broadcast();
			}
			return new Response(JSON.stringify({ ok: true }));
		}

		// Sound control (host grants) + sound effects
		if (path === '/sound-control' && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			const target = r.participants[String(body.userId ?? '')];
			if (target) {
				target.canControlSounds = Boolean(body.granted);
				r.seq += 1;
				await this.save();
				this.broadcast();
			}
			return new Response(JSON.stringify({ ok: true }));
		}
		if (path === '/sound' && req.method === 'POST') {
			const r = await this.load();
			const p = r.participants[userId];
			const allowed = r.hostUserId === userId || p?.canControlSounds;
			if (!allowed) return new Response('forbidden', { status: 403 });
			r.soundEffect = String(body.effect ?? 'applause');
			r.soundSeq += 1;
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true }));
		}

		// Queue (host only)
		if (path === '/queue' && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			r.queue.push({
				id: ++this.queueId,
				position: r.queue.length + 1,
				title: String(body.title ?? 'Untitled'),
				mediaType: body.mediaType === 'tv' ? 'tv' : 'movie',
				tmdbId: Number(body.tmdbId ?? 0),
				season: body.season ?? null,
				episode: body.episode ?? null,
				providerId: body.provider?.id ?? null,
				providerName: body.provider?.name ?? null,
				addedBy: username,
				addedAt: Date.now()
			});
			r.seq += 1;
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true }));
		}
		const delQueue = path.match(/^\/queue\/(\d+)$/);
		if (delQueue && req.method === 'DELETE') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			r.queue = r.queue.filter((q) => q.id !== Number(delQueue[1]));
			r.queue.forEach((q, i) => (q.position = i + 1));
			r.seq += 1;
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true }));
		}
		if (path === '/queue/reorder' && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			const ids: number[] = body.orderedIds ?? [];
			r.queue.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
			r.queue.forEach((q, i) => (q.position = i + 1));
			r.seq += 1;
			await this.save();
			this.broadcast();
			return new Response(JSON.stringify({ ok: true }));
		}
		if (path === '/queue/advance' && req.method === 'POST') {
			if (!(await this.requireHost(userId))) return new Response('forbidden', { status: 403 });
			const r = await this.load();
			const nextQ = r.queue.shift();
			if (nextQ) {
				r.title = nextQ.title;
				r.mediaType = nextQ.mediaType;
				r.tmdbId = nextQ.tmdbId;
				r.season = nextQ.season;
				r.episode = nextQ.episode;
				r.providerId = nextQ.providerId;
				r.providerName = nextQ.providerName;
				r.playing = false;
				r.position = 0;
				r.positionAt = Date.now();
				r.seq += 1;
				r.queue.forEach((q, i) => (q.position = i + 1));
				await this.save();
				this.broadcast();
				return new Response(JSON.stringify({ advanced: nextQ }));
			}
			return new Response(JSON.stringify({ advanced: null }));
		}

		return new Response('not found', { status: 404 });
	}
}

function now(): number {
	return Date.now();
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const origin = req.headers.get('origin');
		if (req.method === 'OPTIONS') {
			return new Response(null, { headers: cors(origin, env) });
		}
		const url = new URL(req.url);
		const m = url.pathname.match(/^\/api\/watch-party\/rooms\/([A-Z0-9]{6})(\/.*)?$/);

		// Create room — retry with a fresh code if the DO already exists.
		if (url.pathname === '/api/watch-party/rooms' && req.method === 'POST') {
			const body = await req.json().catch(() => ({}));
			const initReq = (roomId: string) =>
				new Request(
					`https://do/init?u=${encodeURIComponent(String(body.u ?? ''))}&n=${encodeURIComponent(String(body.n ?? 'Host'))}`,
					{ method: 'POST', body: JSON.stringify(body) }
				);
			let roomId = code();
			for (let attempt = 0; attempt < 5; attempt++) {
				const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
				const res = await stub.fetch(initReq(roomId));
				if (res.status === 409) {
					roomId = code();
					continue;
				}
				return json({ roomId, code: roomId }, env, origin);
			}
			return json({ ok: false, error: 'could not allocate room code' }, env, origin, 500);
		}

		if (m) {
			const roomId = m[1];
			const sub = m[2] ?? '/';
			const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
			const doUrl = new URL(req.url);
			doUrl.pathname = sub;
			const res = await stub.fetch(new Request(doUrl.toString(), req));
			const res2 = new Response(res.body, res);
			for (const [k, v] of Object.entries(cors(origin, env))) res2.headers.set(k, v);
			return res2;
		}

		return json({ ok: false, error: 'not found' }, env, origin, 404);
	}
};
