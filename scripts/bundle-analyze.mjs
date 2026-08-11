import { readFileSync } from 'fs';

const s = JSON.parse(readFileSync('./bundle-baseline.json', 'utf8'));
const parts = s.nodeParts;

const modSize = {}; // moduleId -> {raw, gzip}
for (const m of Object.values(s.nodeMetas)) {
	let raw = 0, gzip = 0;
	for (const uid of Object.values(m.moduleParts || {})) {
		const p = parts[uid];
		if (p) { raw += p.renderedLength; gzip += p.gzipLength; }
	}
	modSize[m.id] = { raw, gzip };
}

const byPkg = {};
const appDirs = {};
for (const [id, sz] of Object.entries(modSize)) {
	const nm = id.indexOf('node_modules');
	if (nm >= 0) {
		const rest = id.slice(nm + 13);
		const pkg = rest.split(/[\\/]/)[0];
		byPkg[pkg] = byPkg[pkg] || { raw: 0, gzip: 0 };
		byPkg[pkg].raw += sz.raw; byPkg[pkg].gzip += sz.gzip;
	} else if (id.startsWith('C:/') || id.startsWith('src')) {
		const seg = id.replace(/^C:[\\/]+/i, '').split(/[\\/]/);
		const dir = seg.slice(0, 3).join('/');
		appDirs[dir] = appDirs[dir] || { raw: 0, gzip: 0 };
		appDirs[dir].raw += sz.raw; appDirs[dir].gzip += sz.gzip;
	}
}

let totalRaw = 0, totalGzip = 0;
for (const [, sz] of Object.entries(modSize)) { totalRaw += sz.raw; totalGzip += sz.gzip; }

const kb = (n) => (n / 1024).toFixed(1);

console.log(`TOTAL bundled (raw ${kb(totalRaw)} kB, gzip ${kb(totalGzip)} kB, modules ${Object.keys(modSize).length})`);
console.log('\nTop node_modules by raw size:');
Object.entries(byPkg).sort((a, b) => b[1].raw - a[1].raw).slice(0, 14).forEach(([p, sz]) => {
	console.log(`  ${p.padEnd(28)} raw ${String(kb(sz.raw)).padStart(8)} kB  gzip ${kb(sz.gzip)} kB`);
});
console.log('\nApp code by top-level dir:');
Object.entries(appDirs).sort((a, b) => b[1].raw - a[1].raw).slice(0, 8).forEach(([d, sz]) => {
	console.log(`  ${d.padEnd(28)} raw ${String(kb(sz.raw)).padStart(8)} kB  gzip ${kb(sz.gzip)} kB`);
});