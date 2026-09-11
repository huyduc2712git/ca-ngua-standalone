import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createApp } from '../server.mjs';
import { createNetworkConfig, normalizeHostOrigin } from '../dist/network.mjs';
import { buildVercel } from '../scripts/build-vercel.mjs';

const frontend = 'https://ca-ngua-demo.vercel.app';

async function fixture(t, options = {}) {
  const {server} = createApp({allowedOrigins: [frontend], dice: () => 6, ...options});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const controllers = [];
  t.after(async () => {
    controllers.forEach(c => c.abort());
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  async function request(path, {method = 'GET', body, token, headers = {}} = {}) {
    return fetch(origin + '/api' + path, {
      method, headers: {Origin: frontend, ...(body ? {'Content-Type': 'application/json'} : {}), ...(token ? {'X-Player-Token': token} : {}), ...headers},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
  }
  async function post(path, body, token) {
    const response = await request(path, {method: 'POST', body, token});
    assert.ok(response.ok, await response.clone().text());
    assert.equal(response.headers.get('access-control-allow-origin'), frontend);
    return response.json();
  }
  async function stream(person) {
    const controller = new AbortController(); controllers.push(controller);
    const response = await fetch(origin + `/api/rooms/${person.room.code}/events`, {
      headers: {Origin: frontend, 'X-Player-Token': person.token}, signal: controller.signal,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), frontend);
    assert.equal(response.headers.get('x-accel-buffering'), 'no');
    const states = [], reader = response.body.getReader(), decoder = new TextDecoder();
    const running = (async () => {
      let buffer = '';
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          buffer += decoder.decode(chunk.value, {stream: true});
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const line = block.split('\n').find(s => s.startsWith('data: '));
            if (line) states.push(JSON.parse(line.slice(6)));
          }
        }
      } catch (error) { if (!controller.signal.aborted) throw error; }
    })();
    t.after(async () => { controller.abort(); await running; });
    return states;
  }
  return {request, post, stream, origin};
}

test('Vercel preflight allows only the configured origin, methods and player-token header', async t => {
  const f = await fixture(t);
  const response = await f.request('/rooms', {method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type, x-player-token',
  }});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), frontend);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.match(response.headers.get('vary'), /Origin/);
  for (const origin of ['https://attacker.vercel.app', frontend + '.evil.test', 'null', 'not-a-url']) {
    const denied = await f.request('/rooms', {method: 'OPTIONS', headers: {Origin: origin, 'Access-Control-Request-Method': 'POST'}});
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
  const method = await f.request('/rooms', {method: 'OPTIONS', headers: {'Access-Control-Request-Method': 'DELETE'}});
  assert.equal(method.status, 405);
  const header = await f.request('/rooms', {method: 'OPTIONS', headers: {'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization'}});
  assert.equal(header.status, 403);
  const error = await f.request('/rooms/ABCDEF', {token: 'a'.repeat(64)});
  assert.equal(error.status, 404);
  assert.equal(error.headers.get('access-control-allow-origin'), frontend);
});

test('Two players from the Vercel origin join, authenticate SSE, roll, move and restore one Render room', async t => {
  const f = await fixture(t);
  const a = await f.post('/rooms', {name: 'An', capacity: 2});
  const b = await f.post(`/rooms/${a.room.code}/join`, {name: 'Bình'});
  const statesA = await f.stream(a), statesB = await f.stream(b);
  let revision = b.room.revision, index = 0;
  async function action(person, type, payload = {}) {
    const result = await f.post(`/rooms/${a.room.code}/action`, {type, revision, actionId: `deployment-${++index}`, ...payload}, person.token);
    revision = result.room.revision; return result.room;
  }
  await action(b, 'ready', {ready: true});
  await action(a, 'start');
  await action(a, 'roll', {die: 2});
  const moved = await action(a, 'move', {piece: 0});
  assert.equal(moved.game.players[0].pieces[0], 0);
  assert.equal(moved.game.current, 0);
  const until = Date.now() + 2000;
  while ((statesA.at(-1)?.revision !== revision || statesB.at(-1)?.revision !== revision) && Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(statesA.at(-1).revision, revision);
  assert.deepEqual(statesA.at(-1), statesB.at(-1));
  const restored = await f.request(`/rooms/${a.room.code}`, {token: b.token});
  assert.deepEqual((await restored.json()).room.game, moved.game);
  assert.equal((await f.request(`/rooms/${a.room.code}`, {token: 'a'.repeat(64)})).status, 401);
  const leak = JSON.stringify(statesA);
  assert.ok(!leak.includes(a.token) && !leak.includes(b.token));
});

test('Standalone defaults reject foreign origins and Render proxy accepts its own HTTPS origin', async t => {
  const local = await fixture(t, {allowedOrigins: []});
  assert.equal((await local.request('/health')).status, 403);
  assert.equal((await local.request('/health', {headers: {Origin: local.origin}})).status, 200);
  const render = await fixture(t, {trustProxy: true, allowedOrigins: []});
  assert.equal((await render.request('/health', {headers: {Origin: render.origin.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https'}})).status, 200);
  assert.throws(() => createApp({allowedOrigins: ['*']}), /host/);
});

test('Network config scopes seat tokens by host and rejects unsafe or mixed-content origins', () => {
  const local = createNetworkConfig(), remote = createNetworkConfig(' https://host.example/ ', frontend);
  assert.equal(local.endpoint('/rooms'), '/api/rooms');
  assert.equal(local.sessionKey, 'horse-session');
  assert.equal(remote.endpoint('/rooms/ABCDEF/events'), 'https://host.example/api/rooms/ABCDEF/events');
  assert.ok(remote.timeout >= 60_000);
  assert.notEqual(remote.sessionKey, createNetworkConfig('https://other.example').sessionKey);
  assert.notEqual(remote.resumeKey, local.resumeKey);
  for (const value of ['javascript:alert(1)', '//host.example', 'https://host.example/api', 'https://host.example/?token=secret', 'https://host.example/#room', 'https://user:pass@host.example', 'https://*.vercel.app']) {
    assert.throws(() => normalizeHostOrigin(value));
  }
  assert.throws(() => createNetworkConfig('http://host.example', frontend), /HTTPS/);
  assert.throws(() => remote.endpoint('//attacker.test'));
});

test('Vercel output preserves standalone, caches every offline asset and changes cache when host or UI changes', t => {
  const root = mkdtempSync(fileURLToPath(new URL('../.test-data-vercel-', import.meta.url)));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  cpSync(new URL('../dist', import.meta.url), join(root, 'dist'), {recursive: true});
  const originalConfig = readFileSync(join(root, 'dist/host-config.mjs'), 'utf8');
  const originalWorker = readFileSync(join(root, 'dist/sw.js'), 'utf8');
  assert.throws(() => buildVercel({root, hostUrl: ''}), /HOST_URL/);
  assert.equal(existsSync(join(root, 'vercel-dist')), false);
  const first = buildVercel({root, hostUrl: 'https://first.example/'});
  assert.equal(buildVercel({root, hostUrl: 'https://first.example'}).cacheVersion, first.cacheVersion);
  assert.equal(readFileSync(join(root, 'dist/host-config.mjs'), 'utf8'), originalConfig);
  assert.equal(readFileSync(join(root, 'dist/sw.js'), 'utf8'), originalWorker);
  assert.match(readFileSync(join(first.output, 'host-config.mjs'), 'utf8'), /https:\/\/first.example/);
  assert.match(readFileSync(join(first.output, 'index.html'), 'utf8'), /connect-src 'self' https:\/\/first.example/);
  const handlers = {}; let cached = [];
  vm.runInNewContext(readFileSync(join(first.output, 'sw.js'), 'utf8'), {
    self: {addEventListener: (name, fn) => { handlers[name] = fn; }},
    caches: {open: async () => ({addAll: async assets => { cached = assets; }})},
  });
  const verify = async () => {
    let installed;
    handlers.install({waitUntil: promise => { installed = promise; }}); await installed;
    for (const path of cached) assert.ok(existsSync(join(first.output, path === '/' ? 'index.html' : path.slice(1))), path);
    assert.ok(cached.includes('/host-config.mjs') && cached.includes('/network.mjs'));
    const next = buildVercel({root, hostUrl: 'https://second.example'});
    assert.notEqual(next.cacheVersion, first.cacheVersion);
    writeFileSync(join(root, 'dist/style.css'), readFileSync(join(root, 'dist/style.css'), 'utf8') + '\n/* new UI */\n');
    assert.notEqual(buildVercel({root, hostUrl: 'https://second.example'}).cacheVersion, next.cacheVersion);
    assert.equal(existsSync(join(next.output, 'server.mjs')), false);
    assert.equal(existsSync(join(next.output, 'host.mjs')), false);
  };
  return verify();
});
