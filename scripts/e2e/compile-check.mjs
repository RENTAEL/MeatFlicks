import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';

const src = readFileSync('src/routes/(app)/watch/[roomId]/+page.svelte', 'utf8');
const { js } = compile(src, { filename: 'Watch.svelte', generate: 'client' });

const code = js.code;
const lines = code.split('\n');

function grep(pattern) {
	return lines.map((l, i) => `${i + 1}: ${l}`).filter((l) => pattern.test(l));
}

console.log('=== state assignment sites (invalidate) ===');
for (const l of grep(/invalidate\(0, state\)|state\);/)) console.log(l.slice(0, 160));
console.log('\n=== canTriggerSounds occurrences in render ===');
for (const l of grep(/canTriggerSounds/)) console.log(l.slice(0, 200));
console.log('\n=== how fx-btn disabled compiles ===');
for (const l of grep(/disabled|allowed/)) console.log(l.slice(0, 160));
