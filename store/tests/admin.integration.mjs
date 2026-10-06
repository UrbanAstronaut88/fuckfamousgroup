import assert from "node:assert/strict";
import * as OTPAuth from "otpauth";
// Workerd closes HTTP/1 connections after early rejections with unread bodies.
// Node 22's pooled fetch can race that close during rapid negative tests.
const fetch = (url, options = {}) => globalThis.fetch(url, {
  ...options, headers: { ...options.headers, Connection: "close" },
});
const base = process.env.FFG_TEST_BASE_URL;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):3011$/.test(base) || !process.env.FFG_TEST_SETUP_TOKEN)
  throw Error("Use an isolated fresh test database on port 3011 and explicitly set FFG_TEST_BASE_URL and FFG_TEST_SETUP_TOKEN. Never use your working catalog.");
let cookie = "";
async function request(path, body, opts = {}) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...opts.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { r, data };
}
const publicBefore = await request("/api/products");
assert.equal((await fetch(base + '/admin')).status, 404);
const loginPage = await fetch(base + '/dima_dinamo_admin');
assert.equal(loginPage.status, 200);
assert.match(loginPage.headers.get('x-robots-tag'), /noindex/);
assert.equal(publicBefore.r.status, 200);
assert.equal(JSON.stringify(publicBefore.data).includes('admin_credential'), false);
const singleStickers = publicBefore.data.products.filter(p => p.slug.startsWith('ffg-sticker-camo-'));
assert.equal(singleStickers.length, 3);
assert.equal(new Set(singleStickers.map(p => p.image)).size, 3);
assert.ok(singleStickers.every(p => p.category === 'sticker' && p.pricePending === 1));
assert.ok(publicBefore.data.products.every(p => !p.isDemo));
assert.ok(publicBefore.data.products.every((p) => p.titleEn));
const release = publicBefore.data.products.filter(p => p.category === 'hoodie' && p.image.startsWith('/images/merch/'));
assert.equal(release.length, 6);
const sticker = publicBefore.data.products.filter(p => p.slug === 'ffg-sticker-pack');
assert.equal(sticker.length, 1);
assert.equal(sticker[0].category, 'sticker');
assert.equal(sticker[0].size, '10 × 15 CM');
assert.equal(sticker[0].pricePending, 1);
assert.ok(release.every(p => p.pricePending === 1 && p.quantity === 0));
assert.equal((await request('/api/products')).data.products.length, publicBefore.data.products.length);
let result = await request("/api/admin");
assert.equal(result.r.status, 200);
assert.equal(result.data.authenticated, false);
assert.equal(result.data.credential, undefined);
assert.equal(result.data.password, undefined);
assert.equal(result.data.admin_credential, undefined);
assert.equal(result.data.products, undefined);
assert.equal(result.data.configured, true);
assert.equal(result.data.setupAvailable, false);
assert.equal((await request("/api/admin", { action: "save" })).r.status, 401);
assert.equal(
  (
    await request(
      "/api/admin",
      { action: "save" },
      { headers: { Origin: "https://outside.example" } },
    )
  ).r.status,
  403,
);
const setupToken = process.env.FFG_TEST_SETUP_TOKEN;
assert.equal((await request("/api/admin", { action: "setup", setupToken, password: "Local-FFG-validation-2026!" })).r.status, 404);
assert.equal((await request("/api/admin", { action: "login", login: "wrong-user", password: "Local-FFG-validation-2026!" })).r.status, 401);
result = await request("/api/admin", {
  action: "login", login: "test-owner",
  password: "Local-FFG-validation-2026!",
});
assert.equal(result.r.status, 200, JSON.stringify(result.data));
cookie = result.r.headers.get("set-cookie").split(";")[0];
assert.match(result.r.headers.get("set-cookie"), /HttpOnly/);
assert.match(result.r.headers.get("set-cookie"), /SameSite=Strict/);
assert.equal(
  (
    await request("/api/admin", {
      action: "setup",
      setupToken,
      password: "Not-allowed-to-reset!",
    })
  ).r.status,
  404,
);
result = await request("/api/admin");
assert.equal(result.data.authenticated, true);
assert.equal(result.data.enrollmentRequired, true);
assert.equal(result.data.products, undefined);
assert.equal((await request("/api/admin", { action: "save" })).r.status, 403);
assert.equal((await fetch(base + "/api/admin/upload", { method: "POST", headers: { Origin: base, Cookie: cookie }, body: "x" })).status, 403);
const enrollment = await request("/api/admin", { action: "mfa_begin", currentPassword: "Local-FFG-validation-2026!" });
assert.equal(enrollment.r.status, 200, JSON.stringify(enrollment.data));
const otp = new OTPAuth.TOTP({ secret: enrollment.data.secret, algorithm: "SHA1", digits: 6, period: 30 });
const enrolledCode = otp.generate();
const enrolled = await request("/api/admin", { action: "mfa_confirm", code: enrolledCode });
assert.equal(enrolled.r.status, 200, JSON.stringify(enrolled.data));
const recoveryCodes = enrolled.data.recoveryCodes;
assert.equal(recoveryCodes.length, 8);
assert.equal((await request("/api/admin", { action: "login", login: "test-owner", password: "Local-FFG-validation-2026!", code: enrolledCode })).r.status, 401);
const beforeMfa = cookie;
cookie = enrolled.r.headers.get("set-cookie").split(";")[0];
assert.equal((await request("/api/admin", undefined, { headers: { Cookie: beforeMfa } })).data.authenticated, false);
result = await request("/api/admin");
assert.equal(result.data.mfaEnabled, true);
assert.equal(result.data.enrollmentRequired, false);
let revision = result.data.revision;
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const bad = await fetch(base + "/api/admin/upload", {
  method: "POST",
  headers: { Origin: base, Cookie: cookie },
  body: "<svg></svg>",
});
assert.equal(bad.status, 400);
const upload = await fetch(base + "/api/admin/upload", {
  method: "POST",
  headers: { Origin: base, Cookie: cookie, "Content-Type": "image/png" },
  body: image,
});
const uploaded = await upload.json();
assert.equal(upload.status, 200, JSON.stringify(uploaded));
const media = await fetch(base + uploaded.image);
assert.equal(media.status, 200);
assert.equal(media.headers.get("content-type"), "image/png");
assert.deepEqual(Buffer.from(await media.arrayBuffer()), image);
let draft = {
  action: "save",
  revision,
  slug: "qa-integration-" + Date.now(),
  title: "Тестовий товар",
  titleEn: "Test product",
  subtitle: "Тест",
  subtitleEn: "Test",
  description: "Локальна перевірка",
  descriptionEn: "Local validation",
  price: 1200,
  category: "tshirt",
  image: uploaded.image,
  active: false,
  variants: [
    { size: "S", quantity: 4 },
    { size: "XL", quantity: 2 },
  ],
};
result = await request("/api/admin", draft);
assert.equal(result.r.status, 200, JSON.stringify(result.data));
revision = result.data.revision;
assert.ok(
  !(await request("/api/products")).data.products.some(
    (p) => p.slug === draft.slug,
  ),
);
draft = { ...draft, revision, active: true };
result = await request("/api/admin", draft);
assert.equal(result.r.status, 200);
revision = result.data.revision;
let variants = (await request("/api/products")).data.products.filter(
  (p) => p.slug === draft.slug,
);
assert.equal(variants.length, 2);
assert.equal(variants[0].titleEn, "Test product");
assert.equal(variants[0].isDemo, 0);
assert.equal(
  (
    await request("/api/admin", {
      ...draft,
      revision,
      variants: [{ size: "S", quantity: -1 }],
    })
  ).r.status,
  400,
);
const conflict = await Promise.all([
  request("/api/admin", { ...draft, revision, title: "Перший редактор" }),
  request("/api/admin", { ...draft, revision, title: "Другий редактор" }),
]);
assert.deepEqual(conflict.map((x) => x.r.status).sort(), [200, 409]);
revision = conflict.find((x) => x.r.status === 200).data.revision;
result = await request("/api/admin", {
  ...draft,
  revision,
  variants: [{ size: "ONE SIZE", quantity: 0 }],
});
assert.equal(result.r.status, 200);
revision = result.data.revision;
variants = (await request("/api/products")).data.products.filter(
  (p) => p.slug === draft.slug,
);
assert.equal(variants.length, 1);
assert.equal(variants[0].size, "ONE SIZE");
result = await request("/api/admin", { ...draft, revision, active: false });
assert.equal(result.r.status, 200);
assert.ok(
  !(await request("/api/products")).data.products.some(
    (p) => p.slug === draft.slug,
  ),
);
const oldCookie = cookie;
revision = result.data.revision;
const pendingSticker = await request('/api/admin', { ...draft, revision, category: 'sticker', price: 0 });
assert.equal(pendingSticker.r.status, 200, JSON.stringify(pendingSticker.data));
assert.ok(pendingSticker.data.products.filter(p => p.slug === draft.slug).every(p => p.pricePending === 1 && p.category === 'sticker'));
revision = pendingSticker.data.revision;
const published = await request("/api/admin", { ...draft, revision, active: true });
assert.equal(published.r.status, 200);
assert.ok(published.data.products.filter(p => p.slug === draft.slug).every(p => p.pricePending === 0 && p.price === draft.price));
revision = published.data.revision;
assert.equal((await request("/api/admin", { action: "delete", slug: draft.slug, revision: revision - 1 })).r.status, 409);
assert.ok((await request("/api/products")).data.products.some(p => p.slug === draft.slug));
assert.equal((await request("/api/admin", { action: "delete", slug: draft.slug, revision }, { headers: { Cookie: "" } })).r.status, 401);
assert.equal((await request("/api/admin", { action: "delete", slug: draft.slug, revision }, { headers: { Origin: "https://outside.example" } })).r.status, 403);
const deleted = await request("/api/admin", { action: "delete", slug: draft.slug, revision });
assert.equal(deleted.r.status, 200, JSON.stringify(deleted.data));
assert.equal(deleted.data.revision, revision + 1);
assert.ok(!deleted.data.products.some(p => p.slug === draft.slug));
assert.ok(!(await request("/api/products")).data.products.some(p => p.slug === draft.slug));
assert.equal((await request("/api/admin", { ...draft, revision })).r.status, 409);
assert.equal((await request("/api/admin", { action: "delete", slug: draft.slug, revision: deleted.data.revision })).r.status, 404);
console.log("PASS: deletion removes all variants; auth/Origin required; stale edits cannot restore a deleted product.");
result = await request("/api/admin", {
  action: "password",
  currentPassword: "Local-FFG-validation-2026!",
  password: "Local-FFG-new-password-2026!",
});
assert.equal(result.r.status, 200);
cookie = result.r.headers.get("set-cookie").split(";")[0];
assert.equal(
  (await request("/api/admin", undefined, { headers: { Cookie: oldCookie } }))
    .data.authenticated,
  false,
);
await request("/api/admin", { action: "logout" });
assert.equal((await request("/api/admin")).data.authenticated, false);
assert.equal((await request("/api/admin", { action: "save" })).r.status, 401);
assert.equal(
  (
    await request("/api/admin", {
      action: "login", login: "test-owner",
      password: "Local-FFG-validation-2026!",
    })
  ).r.status,
  401,
);
assert.equal(
  (
    await request("/api/admin", {
      action: "login", login: "test-owner",
      password: "Local-FFG-new-password-2026!",
      code: recoveryCodes[0],
    })
  ).r.status,
  200,
);
assert.equal((await request("/api/admin", { action: "login", login: "test-owner", password: "Local-FFG-new-password-2026!", code: recoveryCodes[0] })).r.status, 401);
assert.equal((await request("/api/admin", { action: "login", login: "test-owner", password: "Local-FFG-new-password-2026!" })).r.status, 401);
const adminPage = await fetch(base + "/admin");
assert.equal(adminPage.headers.get("cache-control"), "no-store");
assert.equal(adminPage.headers.get("x-frame-options"), "DENY");
assert.match(adminPage.headers.get("content-security-policy"), /frame-ancestors 'none'/);
await adminPage.text();
assert.equal((await request("/api/internal/cancel", { orderId: "none" })).r.status, 410);
const recovered = await request("/api/admin", { action: "login", login: "test-owner", password: "Local-FFG-new-password-2026!", code: recoveryCodes[1] });
assert.equal(recovered.r.status, 429, JSON.stringify(recovered.data));
assert.equal(recovered.r.headers.get("retry-after"), "900");
console.log(
  "PASS: bilingual catalog; setup; auth; CSRF; mandatory MFA; enrollment; recovery code replay rejection; revoked sessions; security headers; rate limits; disabled cancellation; upload/media; create/edit/hide; stock validation; concurrent saves; password rotation; logout.",
);
