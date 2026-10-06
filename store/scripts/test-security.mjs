import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes, createHmac, pbkdf2Sync } from 'node:crypto';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secret = randomBytes(32).toString('hex'), setup = randomBytes(32).toString('hex');
const initialSalt = randomBytes(32).toString('hex');
const initialCredential = JSON.stringify({salt: initialSalt, iterations: 600000, password: pbkdf2Sync(createHmac('sha256',secret).update('Local-FFG-validation-2026!').digest(),initialSalt,600000,32,'sha256').toString('hex')});
const base = 'http://127.0.0.1:3011';
try { await fetch(base); throw Error('Port 3011 is already in use. Stop that test server first.'); }
catch (error) { if (!error.cause) throw error; }
// Run the built Worker directly: no Wrangler file watcher, no working database,
// no real credentials, and no implicit reload during a security test.
const serverRoot = path.join(project, 'dist/server');
const moduleNames = ['index.js', ...fs.readdirSync(serverRoot, { recursive: true }).filter(name => /\.(?:js|mjs)$/.test(name) && name !== 'index.js')];
const server = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1', port: 3011, name: 'ffg-security-test',
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  modules: moduleNames.map(name => ({ type: 'ESModule', path: path.join(serverRoot, name) })), modulesRoot: serverRoot,
  assets: { directory: path.join(project, 'dist/client'), binding: 'ASSETS', routerConfig: { has_user_worker: true }, run_worker_first: true },
  d1Databases: ['DB'], d1Persist: false, r2Buckets: ['MEDIA'], r2Persist: false,
  bindings: { ADMIN_SECRET: secret, ADMIN_INITIAL_CREDENTIAL: initialCredential, ADMIN_LOGIN: 'test-owner', ADMIN_REQUIRE_MFA: 'true' },
}));
try {
  await server.ready;
  const db = await server.getD1Database('DB');
  for (const file of fs.readdirSync(path.join(project, 'drizzle')).filter(name => name.endsWith('.sql')).sort()) {
    const statements = fs.readFileSync(path.join(project, 'drizzle', file), 'utf8').split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) await db.prepare(statement).run();
  }
  await db.prepare("INSERT INTO products (slug,title,size,price,quantity,image,category,is_demo,subtitle,description) VALUES ('retired-demo','Demo','M',100,5,'/images/demo.jpg','hoodie',1,'','')").run();
  const result = await new Promise((resolve, reject) => {
    const test = spawn(process.execPath, ['tests/admin.integration.mjs'], { cwd: project,
      env: { ...process.env, FFG_TEST_BASE_URL: base, FFG_TEST_SETUP_TOKEN: setup }, stdio: 'inherit', windowsHide: true });
    test.on('error', reject); test.on('exit', resolve);
  });
  assert.equal(result, 0, 'Integration checks failed');
  const retired = await db.prepare("SELECT archived,active FROM products WHERE slug='retired-demo'").first();
  assert.deepEqual(retired, { archived: 1, active: 0 });
  const revisionBefore = await db.prepare("SELECT value FROM settings WHERE key='catalog_revision'").first();
  await fetch(base + '/api/products');
  assert.deepEqual(await db.prepare("SELECT value FROM settings WHERE key='catalog_revision'").first(), revisionBefore);
  const password = 'Legacy-test-password-only!', salt = randomBytes(32).toString('hex');
  const entry = JSON.stringify({ salt, password: pbkdf2Sync(createHmac('sha256', secret).update(password).digest(), salt, 100000, 32, 'sha256').toString('hex') });
  await db.prepare("UPDATE settings SET value=? WHERE key='admin_credential'").bind(entry).run();
  // Reset the isolated fixture's limiter before checking migration compatibility.
  await db.prepare('DELETE FROM admin_rate_limits').run();
  const legacyLogin = await fetch(base + '/api/admin', { method: 'POST', headers: {
    Origin: base, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ action: 'login', login: 'test-owner', password }) });
  assert.equal(legacyLogin.status, 200, await legacyLogin.text());
  const saved = await db.prepare("SELECT json_extract(value,'$.iterations') AS iterations FROM settings WHERE key='admin_credential'").first();
  assert.equal(saved.iterations, 600000);
  const secureLogin = await server.dispatchFetch('https://security-test.example/api/admin', { method: 'POST',
    headers: { Origin: 'https://security-test.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', login: 'test-owner', password }),
  });
  assert.equal(secureLogin.status, 200, await secureLogin.text());
  assert.match(secureLogin.headers.get('set-cookie'), /^__Host-ffg_admin=/);
  assert.match(secureLogin.headers.get('set-cookie'), /; Secure/);
  assert.match(secureLogin.headers.get('strict-transport-security'), /max-age=/);
  const cookie = legacyLogin.headers.get('set-cookie').split(';')[0];
  await db.prepare('UPDATE admin_sessions SET last_seen=0').run();
  const idle = await fetch(base + '/api/admin', { headers: { Cookie: cookie } });
  assert.equal((await idle.json()).authenticated, false);
  console.log('PASS: legacy password upgrade, idle timeout. Only isolated test storage was modified.');
} finally { await server.dispose(); }

