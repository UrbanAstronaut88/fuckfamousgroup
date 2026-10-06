import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomBytes, createHmac, pbkdf2Sync } from 'node:crypto';

// Run interactively. Passwords never enter command history, logs or source files.
if (!process.stdin.isTTY) throw Error('Run in an interactive terminal.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');
const target = local ? path.join(root, '.dev.vars') : path.join(root, '.sites-runtime/admin-initial.env');
if (!local && fs.existsSync(target)) throw Error('Private output already exists; move it securely before continuing.');
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk); done(); } });
const rl = createInterface({ input: process.stdin, output, terminal: true });
async function hidden(prompt) {
  process.stdout.write(prompt);
  muted = true;
  try { return await rl.question(''); }
  finally { muted = false; process.stdout.write('\n'); }
}
try {
  const login = (await rl.question('Admin login: ')).trim();
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(login)) throw Error('Use 3–64 letters, digits, dots, underscores or hyphens.');
  const previous = local && fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const vars = parseEnv(previous);
  const secret = local ? (vars.ADMIN_SECRET || randomBytes(32).toString('hex')) : await hidden('Existing hosting ADMIN_SECRET (empty only for a new installation): ');
  const pepper = secret || randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/i.test(pepper)) throw Error('ADMIN_SECRET must be the existing 64-character hex secret.');
  const password = await hidden('Initial password (16–128 characters): ');
  if (password.length < 16 || password.length > 128) throw Error('Password must have 16–128 characters.');
  if (password !== await hidden('Repeat password: ')) throw Error('Passwords do not match.');
  const salt = randomBytes(32).toString('hex');
  const entry = JSON.stringify({ salt, iterations: 600000, password: pbkdf2Sync(createHmac('sha256', pepper).update(password).digest(), salt, 600000, 32, 'sha256').toString('hex') });
  const cleaned = previous.replace(/^(ADMIN_LOGIN|ADMIN_SECRET|ADMIN_INITIAL_CREDENTIAL|ADMIN_SETUP_TOKEN)=.*\r?\n?/gm, '');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${cleaned}\nADMIN_LOGIN=${login}\nADMIN_SECRET='${pepper.replaceAll("'", '')}'\nADMIN_INITIAL_CREDENTIAL='${entry}'\n`, { mode: 0o600 });
  console.log(local ? 'Local initial settings saved. Restart the server. Existing accounts are never overwritten.' : 'Private settings saved in .sites-runtime/admin-initial.env. Add these three values as hosting secrets; never commit this file.');
} finally { rl.close(); }
