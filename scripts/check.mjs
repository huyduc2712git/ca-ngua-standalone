import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const file of ['dist/host-config.mjs','dist/network.mjs','scripts/build-vercel.mjs','tests/deployment.test.mjs']){const r=spawnSync(process.execPath,['--check',resolve(root,file)],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
for(const file of ['server.mjs','host-core.mjs','room-store.mjs','scripts/build-host.mjs','dist/sw.js','dist/pwa.mjs','dist/board3d.mjs','dist/board-art.mjs','dist/turn-status.mjs','dist/geometry.mjs','dist/horse-geometry.mjs','dist/motion.mjs','dist/app.mjs','dist/engine.mjs','dist/icons.mjs','tests/engine.test.mjs','tests/server.test.mjs','tests/pwa-motion.test.mjs','tests/embedded-host.test.mjs']){const r=spawnSync(process.execPath,['--check',resolve(root,file)],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
const html=readFileSync(resolve(root,'dist/index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="\/(.*?)"/g)){if(match[1]&&!existsSync(resolve(root,'dist',match[1])))throw new Error('Missing local asset: '+match[1]);}
for(const match of readFileSync(resolve(root,'dist/app.mjs'),'utf8').matchAll(/from '\.\/(.*?)'/g))if(!existsSync(resolve(root,'dist',match[1])))throw new Error('Missing module: '+match[1]);
const manifest=JSON.parse(readFileSync(resolve(root,'dist/manifest.webmanifest'),'utf8'));
for(const icon of manifest.icons)if(!existsSync(resolve(root,'dist',icon.src.slice(1))))throw new Error('Missing PWA icon: '+icon.src);
console.log('Standalone build verified: HTML, scripts and local assets. No installation or bundling required.');
