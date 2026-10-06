import { env } from "cloudflare:workers";
import { getRawDb } from "../db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const hash = async (value: string) =>
  hex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    fail(403, "Потрібне захищене з’єднання HTTPS.");
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    fail(403, "Перезавантажте сторінку та спробуйте знову.");
}
export async function bodyBytes(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      fail(413, "Завеликий файл або запит.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export async function jsonBody(request: Request) {
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json")
    fail(415, "Потрібен запит JSON.");
  try {
    return JSON.parse(
      new TextDecoder().decode(await bodyBytes(request, 32000)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return fail(400, "Некоректний запит.");
  }
}
export async function rateLimit(
  request: Request,
  action: string,
  limit: number,
  seconds = 900,
) {
  const key = await hash(
    `${action}:${request.headers.get("CF-Connecting-IP") || "local"}`,
  );
  const now = Math.floor(Date.now() / 1000);
  const row = await getRawDb()
    .prepare(
      `INSERT INTO admin_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count`,
    )
    .bind(key, now + seconds, now, now, now + seconds)
    .first<{ count: number }>();
  if (!row || row.count > limit)
    fail(429, "Забагато спроб. Спробуйте через 15 хвилин.");
  await getRawDb()
    .prepare("DELETE FROM admin_rate_limits WHERE expires_at < ?")
    .bind(now - 86400)
    .run();
}
export async function credential() {
  if (env.ADMIN_INITIAL_CREDENTIAL && env.ADMIN_SECRET && env.ADMIN_LOGIN) {
    const entry = JSON.parse(env.ADMIN_INITIAL_CREDENTIAL);
    if (!/^[a-f0-9]{64}$/.test(entry.salt) || !/^[a-f0-9]{64}$/.test(entry.password) || entry.iterations !== 600000)
      fail(503, "Налаштування адміністратора некоректні.");
    await getRawDb().prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('admin_credential',?)")
      .bind(JSON.stringify({ salt: entry.salt, password: entry.password, iterations: entry.iterations })).run();
  }
  return getRawDb()
    .prepare("SELECT value FROM settings WHERE key='admin_credential'")
    .first<{ value: string }>();
}
export const PASSWORD_ITERATIONS = 600000;
export async function passwordHash(password: string, salt: string, iterations = PASSWORD_ITERATIONS) {
  if (!env.ADMIN_SECRET) fail(503, "Доступ адміністратора ще не налаштовано.");
  // A separate server secret protects password hashes if the database is exposed.
  const pepper = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.ADMIN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const input = await crypto.subtle.sign("HMAC", pepper, enc.encode(password));
  const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" }, key, 256));
}
export type AdminCredential = { salt: string; password: string; iterations?: number; mfa?: string };
export async function verifyPassword(value: unknown, entry: AdminCredential) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128 &&
    secureEqual(await passwordHash(value, entry.salt, entry.iterations || 100000), entry.password);
}
export function mfaRequired(request: Request) {
  // HTTPS deployments cannot opt out. Plain HTTP is allowed only for local development.
  return new URL(request.url).protocol === "https:" || env.ADMIN_REQUIRE_MFA === "true";
}
export async function secureEqual(a: string, b: string) {
  const x = await hash(a);
  const y = await hash(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
export function sessionToken(request: Request) {
  const name = new URL(request.url).protocol === "https:" ? "__Host-ffg_admin" : "ffg_admin";
  return request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`))?.[1] || "";
}
export async function authenticated(request: Request) {
  const token = sessionToken(request);
  if (!token) return false;
  const stored = await credential();
  if (!stored) return false;
  return !!(await getRawDb()
    .prepare(
      "UPDATE admin_sessions SET last_seen=? WHERE token_hash=? AND expires_at>? AND last_seen>? AND credential_hash=? RETURNING token_hash",
    )
    .bind(Date.now(), await hash(token), Date.now(), Date.now() - 30 * 60000, await hash(stored.value))
    .first());
}
export async function requireAdmin(request: Request, allowEnrollment = false) {
  if (!(await authenticated(request)))
    fail(401, "Увійдіть у панель адміністратора.");
  const stored = await credential();
  if (!allowEnrollment && mfaRequired(request) && !JSON.parse(stored!.value).mfa)
    fail(403, "Спочатку підключіть двофакторний захист.");
}
export function cookie(request: Request, token: string, age: number) {
  const secure = new URL(request.url).protocol === "https:";
  return `${secure ? "__Host-ffg_admin" : "ffg_admin"}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
}
export async function createSession(request: Request, credentialValue: string) {
  const token = randomToken();
  const result = await getRawDb().batch([
    getRawDb()
      .prepare("DELETE FROM admin_sessions WHERE expires_at<=?")
      .bind(Date.now()),
    getRawDb()
      .prepare(
        "INSERT INTO admin_sessions (token_hash,expires_at,last_seen,credential_hash) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM settings WHERE key='admin_credential' AND value=?)",
      )
      .bind(await hash(token), Date.now() + 8 * 3600000, Date.now(), await hash(credentialValue), credentialValue),
  ]);
  if (!result[1].meta.changes) fail(401, "Дані доступу змінилися. Увійдіть знову.");
  return cookie(request, token, 8 * 3600);
}
export function adminResponse(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export function adminError(error: unknown) {
  if (error instanceof HttpError)
    return adminResponse({ error: error.message }, error.status, error.status === 429 ? { "Retry-After": "900" } : {});
  console.error("Admin request failed");
  return adminResponse(
    { error: "Не вдалося виконати дію. Спробуйте ще раз." },
    503,
  );
}
