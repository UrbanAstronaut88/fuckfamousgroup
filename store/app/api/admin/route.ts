import { env } from "cloudflare:workers";
import { getRawDb } from "../../../db";
import {
  authenticated, credential, requireAdmin, sameOrigin, rateLimit, jsonBody,
  fail, randomToken, passwordHash, secureEqual, createSession, cookie,
  sessionToken, hash, adminResponse, adminError, verifyPassword, mfaRequired,
  PASSWORD_ITERATIONS, type AdminCredential,
} from "../../../lib/admin";
import { beginMfa, confirmMfa, verifyMfa } from "../../../lib/admin-mfa";
import { adminCatalog, saveProduct, deleteProduct } from "../../../lib/admin-catalog";
export async function GET(request: Request) {
  try {
    const loggedIn = await authenticated(request);
    const stored = await credential();
    const mfaEnabled = !!(stored && JSON.parse(stored.value).mfa);
    const enrollmentRequired = mfaRequired(request) && !mfaEnabled;
    return adminResponse({
      authenticated: loggedIn, configured: !!stored, mfaEnabled, enrollmentRequired,
      setupAvailable: false,
      ...(loggedIn && !enrollmentRequired ? await adminCatalog() : {}),
    });
  } catch (error) { return adminError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await jsonBody(request);
    if (!input || typeof input !== "object" || Array.isArray(input)) fail(400, "Некоректний запит.");
    if (input.action === "logout") {
      const token = sessionToken(request);
      if (token) await getRawDb().prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await hash(token)).run();
      return adminResponse({ ok: true }, 200, { "Set-Cookie": cookie(request, "", 0) });
    }
    if (input.action === "setup") fail(404, "Реєстрація недоступна.");
    if (input.action === "login") {
      await rateLimit(request, "auth", 8);
      const stored = await credential();
      if (!stored || !env.ADMIN_LOGIN) fail(401, "Невірні дані входу.");
      const entry: AdminCredential = JSON.parse(stored.value);
      const passwordValid = await verifyPassword(input.password, entry);
      const loginValid = typeof input.login === "string" && input.login.length <= 128 &&
        await secureEqual(input.login, env.ADMIN_LOGIN);
      if (!passwordValid || !loginValid) fail(401, "Невірні дані входу.");
      try { await verifyMfa(entry, input.code); }
      catch { fail(401, "Невірні дані входу."); }
      let value = stored.value;
      if ((entry.iterations || 100000) < PASSWORD_ITERATIONS) {
        value = JSON.stringify({ ...entry, password: await passwordHash(input.password, entry.salt), iterations: PASSWORD_ITERATIONS });
        const result = await getRawDb().prepare("UPDATE settings SET value=? WHERE key='admin_credential' AND value=?").bind(value, stored.value).run();
        if (!result.meta.changes) fail(409, "Дані входу змінилися. Спробуйте знову.");
      }
      return adminResponse({ ok: true }, 200, { "Set-Cookie": await createSession(request, value) });
    }
    await requireAdmin(request, true);
    if (input.action === "mfa_begin" || input.action === "mfa_confirm") {
      await rateLimit(request, "mfa", 8);
      const stored = (await credential())!;
      if (input.action === "mfa_begin") {
        if (!(await verifyPassword(input.currentPassword, JSON.parse(stored.value)))) fail(401, "Невірний поточний пароль.");
        return adminResponse(await beginMfa(request, stored.value));
      }
      const result = await confirmMfa(request, input.code, stored.value);
      return adminResponse({ recoveryCodes: result.codes }, 200, { "Set-Cookie": await createSession(request, result.credentialValue) });
    }
    await requireAdmin(request);
    if (input.action === "delete") {
      await rateLimit(request, "write", 100);
      return adminResponse(await deleteProduct(input));
    }
    if (input.action === "save") {
      await rateLimit(request, "write", 100);
      return adminResponse(await saveProduct(input));
    }
    if (input.action === "password") {
      await rateLimit(request, "auth", 8);
      const stored = (await credential())!;
      const entry: AdminCredential = JSON.parse(stored.value);
      if (!(await verifyPassword(input.currentPassword, entry))) fail(401, "Невірний поточний пароль.");
      if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 128)
        fail(400, "Новий пароль має містити від 12 до 128 символів.");
      const salt = randomToken();
      const value = JSON.stringify({ ...entry, salt, password: await passwordHash(input.password, salt), iterations: PASSWORD_ITERATIONS });
      const result = await getRawDb().prepare("UPDATE settings SET value=? WHERE key='admin_credential' AND value=?").bind(value, stored.value).run();
      if (!result.meta.changes) fail(409, "Дані входу змінилися. Увійдіть знову.");
      return adminResponse({ ok: true }, 200, { "Set-Cookie": await createSession(request, value) });
    }
    return fail(400, "Невідома дія.");
  } catch (error) { return adminError(error); }
}
