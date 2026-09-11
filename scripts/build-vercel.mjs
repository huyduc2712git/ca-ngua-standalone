import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeHostOrigin } from '../dist/network.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function buildVercel({ root = projectRoot, hostUrl = process.env.HOST_URL || '' } = {}) {
  const origin = normalizeHostOrigin(hostUrl);
  if (!origin.startsWith('https://')) {
    throw new Error('Thiếu HOST_URL HTTPS của Render. Đặt HOST_URL trong Environment Variables của Vercel rồi build lại.');
  }
  const source = resolve(root, 'dist');
  const output = resolve(root, 'vercel-dist');
  rmSync(output, { recursive: true, force: true });
  cpSync(source, output, { recursive: true });
  writeFileSync(join(output, 'host-config.mjs'), `// Public host origin. No secrets belong in this file.\nexport const HOST_ORIGIN = ${JSON.stringify(origin)};\n`);
  const htmlPath = join(output, 'index.html');
  const policy = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${origin}; object-src 'none'; base-uri 'none'; form-action 'self'`;
  const html = readFileSync(htmlPath, 'utf8');
  if (!/<head>/i.test(html)) throw new Error('Thiếu thẻ head trong index.html.');
  writeFileSync(htmlPath, html.replace(/<head>/i, `<head>\n  <meta http-equiv="Content-Security-Policy" content="${policy}">`));
  // A host or asset change must install a different, complete offline cache.
  const digest = createHash('sha256');
  function hashDirectory(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) hashDirectory(join(dir, entry.name), name + '/');
      else { digest.update(name); digest.update('\0'); digest.update(readFileSync(join(dir, entry.name))); }
    }
  }
  hashDirectory(output);
  const cacheVersion = 'ca-ngua-static-vercel-' + digest.digest('hex').slice(0, 16);
  const worker = join(output, 'sw.js');
  const workerSource = readFileSync(worker, 'utf8');
  if (!/^const CACHE='[^']+';/m.test(workerSource)) throw new Error('Không tìm thấy tên cache service worker.');
  writeFileSync(worker, workerSource.replace(/^const CACHE='[^']+';/m, `const CACHE='${cacheVersion}';`));
  return { output, origin, cacheVersion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = buildVercel();
  console.log(`Vercel static PWA built: ${built.output}\nHost: ${built.origin}\nCache: ${built.cacheVersion}`);
}
