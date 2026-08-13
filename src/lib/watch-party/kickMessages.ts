const KICK_MESSAGES: string[] = [
	"You've been kicked. {host} said 'nothing personal, kid.'",
	'Kicked! {host} needed the couch for someone cooler.',
	"You've been ejected. Please exit through the gift shop.",
	"Kicked. {host}'s dog didn't like your vibe.",
	"You've been removed. The popcorn was getting lonely.",
	'Kicked! Try not to take it personally. {host} takes everything personally.',
	"You've been shown the door. It was a very dramatic door.",
	'Kicked. {host} is now watching with someone who laughs at their jokes.',
	"Bounced! {host} upgraded their watch party and you weren't in the patch notes.",
	"Kicked so fast, {host} hasn't even bragged about it yet.",
	'Kicked. Word on the street is {host} is hoarding the good snacks now.',
	"You've been sent to the shadow realm. {host} said it's nothing personal.",
	'Kicked. The couch cushions have already been re-fluffed.',
	'Removed. {host} said you were laughing at the wrong moments.'
];

export function randomKickMessage(host: string): string {
	const line = KICK_MESSAGES[Math.floor(Math.random() * KICK_MESSAGES.length)];
	return line.replaceAll('{host}', host);
}
