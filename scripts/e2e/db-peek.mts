import { db } from '../../src/lib/server/db/client.ts';
import { watchPartyRooms } from '../../src/lib/server/db/schema.ts';
import { sql } from 'drizzle-orm';

const r = await db
	.select({
		id: watchPartyRooms.id,
		seq: watchPartyRooms.seq,
		playing: watchPartyRooms.playing,
		position: watchPartyRooms.position,
		positionAt: watchPartyRooms.positionAt,
		lastActivityAt: watchPartyRooms.lastActivityAt
	})
	.from(watchPartyRooms)
	.where(sql`id = 'QTC8XD'`)
	.get();
console.log('QTC8XD:', JSON.stringify(r));
process.exit(0);
