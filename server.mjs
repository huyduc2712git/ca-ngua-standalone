import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startHost } from './host-core.mjs';
export { createApp, getLanUrls, startHost } from './host-core.mjs';

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startHost();
