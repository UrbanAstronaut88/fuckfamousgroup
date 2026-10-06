import { env } from "cloudflare:workers";
import * as OTPAuth from "otpauth";
import { getRawDb } from "../db";
import { fail, hash, randomToken, sessionToken, type AdminCredential } from "./admin";

const enc = new TextEncoder();
async function encryptionKey() {
  if (!env.ADMIN_SECRET) fail(503, "Доступ ще не налаштовано.");
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(`ffg:mfa:v1:${env.ADMIN_SECRET}`));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), enc.encode(value)));
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(data).toString("base64")}`;
}
async function decrypt(value: string) {
  const [iv, data] = value.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64") }, await encryptionKey(), Buffer.from(data, "base64"),
  ));
}
const totp = (secret: string) => new OTPAuth.TOTP({
  issuer: "FCK Famous Group", label: "Admin", algorithm: "SHA1", digits: 6, period: 30, secret,
});
function step(secret: string, code: unknown) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const timestamp = Date.now();
  const delta = totp(secret).validate({ token: code, window: 1, timestamp });
  return delta === null ? null : Math.floor(timestamp / 30000) + delta;
}
async function pendingKey(request: Request) { return `mfa_pending:${await hash(sessionToken(request))}`; }

export async function beginMfa(request: Request, credentialValue: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const value = JSON.stringify({ secret: await encrypt(secret), expires: Date.now() + 600000, credentialValue });
  const db = getRawDb();
  await db.batch([
    db.prepare("DELETE FROM settings WHERE key LIKE 'mfa_pending:%' AND json_extract(value,'$.expires')<?").bind(Date.now()),
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .bind(await pendingKey(request), value),
  ]);
  return { secret }; // Only the authenticated owner sees this once; never log it.
}

export async function confirmMfa(request: Request, code: unknown, stored: string) {
  const db = getRawDb(), key = await pendingKey(request);
  const row = await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<{ value: string }>();
  if (!row) fail(400, "Спочатку створіть ключ автентифікатора.");
  const pending = JSON.parse(row.value);
  if (pending.expires < Date.now() || pending.credentialValue !== stored) fail(400, "Ключ застарів. Створіть новий.");
  const counter = step(await decrypt(pending.secret), code);
  if (counter === null) fail(401, "Невірний код автентифікатора.");
  const codes = Array.from({ length: 8 }, () => randomToken().slice(0, 24));
  const recovery = await Promise.all(codes.map(code => hash(`ffg:recovery:${code}`)));
  const credentialValue = JSON.stringify({ ...JSON.parse(stored), mfa: pending.secret });
  // Changing the credential invalidates every old session, including concurrent logins.
  const result = await db.batch([
    db.prepare("UPDATE settings SET value=? WHERE key='admin_credential' AND value=?").bind(credentialValue, stored),
    db.prepare("INSERT INTO settings (key,value) SELECT 'admin_mfa_state',? WHERE EXISTS(SELECT 1 FROM settings WHERE key='admin_credential' AND value=?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .bind(JSON.stringify({ counter, recovery }), credentialValue),
    db.prepare("DELETE FROM settings WHERE key=?").bind(key),
  ]);
  if (!result[0].meta.changes) fail(409, "Дані доступу змінилися. Увійдіть знову.");
  return { credentialValue, codes };
}

export async function verifyMfa(entry: AdminCredential, code: unknown) {
  if (!entry.mfa) return;
  if (typeof code !== "string" || code.length > 64) fail(401, "Невірні дані входу або код уже використано.");
  const db = getRawDb();
  const row = await db.prepare("SELECT value FROM settings WHERE key='admin_mfa_state'").first<{ value: string }>();
  if (!row) fail(401, "Не вдалося перевірити другий фактор.");
  const state: { counter: number; recovery: string[] } = JSON.parse(row.value);
  const counter = step(await decrypt(entry.mfa), code.trim());
  if (counter !== null && counter > state.counter) state.counter = counter;
  else {
    const recoveryHash = await hash(`ffg:recovery:${code.trim().toLowerCase()}`);
    if (!state.recovery.includes(recoveryHash)) fail(401, "Невірні дані входу або код уже використано.");
    state.recovery = state.recovery.filter(value => value !== recoveryHash);
  }
  const result = await db.prepare("UPDATE settings SET value=? WHERE key='admin_mfa_state' AND value=?")
    .bind(JSON.stringify(state), row.value).run();
  if (!result.meta.changes) fail(401, "Код уже використано. Спробуйте наступний код.");
}
