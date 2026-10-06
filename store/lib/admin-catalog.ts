import { getRawDb } from "../db";
import { fail } from "./admin";
import type { Product } from "./catalog";
import { hoodieImages, seedHoodieRelease } from "./hoodie-release";
import { stickerImage, seedStickerRelease } from "./sticker-release";
import { singleStickerImages, seedSingleStickers } from "./single-sticker-release";
import { retireDemo } from "./stock";
export const productColumns =
  "id,title,quantity,slug,size,price,price_pending AS pricePending,subtitle,description,image,category,active,title_en AS titleEn,subtitle_en AS subtitleEn,description_en AS descriptionEn,is_demo AS isDemo,archived";
export async function adminCatalog() {
  await retireDemo(getRawDb());
  await seedHoodieRelease(getRawDb());
  await seedStickerRelease(getRawDb());
  await seedSingleStickers(getRawDb());
  const result = await getRawDb().batch([
    getRawDb().prepare(
      `SELECT ${productColumns} FROM products WHERE archived=0 ORDER BY id`,
    ),
    getRawDb().prepare(
      "SELECT value FROM settings WHERE key='catalog_revision'",
    ),
  ]);
  return {
    products: result[0].results as Product[],
    revision: Number(
      (result[1].results[0] as { value: string } | undefined)?.value || 0,
    ),
  };
}
function text(value: unknown, max: number, required = true) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    fail(400, "Перевірте назви та описи товару обома мовами.");
  return (value as string).trim();
}
export async function deleteProduct(input: Record<string, unknown>) {
  const slug = text(input.slug, 80);
  const revision = input.revision;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
    fail(400, "Оновіть каталог і оберіть товар.");
  const db = getRawDb();
  if (!(await db.prepare("SELECT id FROM products WHERE slug=? AND archived=0 LIMIT 1").bind(slug).first()))
    fail(404, "Товар уже видалено або не знайдено.");
  // Archive the whole model; historical order references and shared photos remain valid.
  const results = await db.batch([
    db.prepare("UPDATE products SET archived=1,active=0 WHERE slug=? AND archived=0 AND (SELECT value FROM settings WHERE key='catalog_revision')=?")
      .bind(slug, String(revision)),
    db.prepare("UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision' AND value=? AND changes()>0")
      .bind(String(revision)),
  ]);
  if (!results[0].meta.changes || !results[1].meta.changes)
    fail(409, "Каталог змінився в іншому вікні. Оновіть список перед видаленням.");
  return adminCatalog();
}
export async function saveProduct(input: Record<string, unknown>) {
  const slug = text(input.slug, 80);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug))
    fail(400, "Некоректний ідентифікатор товару.");
  const revision = input.revision;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
    fail(400, "Оновіть каталог.");
  const title = text(input.title, 160),
    titleEn = text(input.titleEn, 160),
    subtitle = text(input.subtitle, 200, false),
    subtitleEn = text(input.subtitleEn, 200, false),
    description = text(input.description, 4000),
    descriptionEn = text(input.descriptionEn, 4000);
  if (
    typeof input.price !== "number" || !Number.isSafeInteger(input.price) ||
    input.price < 0 ||
    input.price > 1000000
  )
    fail(400, "Ціна має бути цілим числом від 0 до 1 000 000 грн. 0 — ціну уточнюйте.");
  if (typeof input.category !== "string" || !["tshirt", "hoodie", "accessory", "sticker"].includes(input.category))
    fail(400, "Оберіть категорію.");
  if (typeof input.active !== "boolean") fail(400, "Вкажіть видимість товару.");
  const image = text(input.image, 200);
  const upload = image.match(
    /^\/api\/media\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/,
  );
  if (
    !upload &&
    !["/images/tshirt.png", "/images/hoodie.png", "/images/cap.png", ...hoodieImages, stickerImage, ...singleStickerImages].includes(
      image,
    )
  )
    fail(400, "Спочатку завантажте фото товару.");
  if (upload) {
    const { env } = await import("cloudflare:workers");
    if (!env.MEDIA || !(await env.MEDIA.head(upload[1])))
      fail(400, "Фото не знайдено. Завантажте його ще раз.");
  }
  if (
    !Array.isArray(input.variants) ||
    input.variants.length < 1 ||
    input.variants.length > 20
  )
    fail(400, "Додайте від 1 до 20 розмірів.");
  const variants: { size: string; quantity: number }[] = input.variants.map(
    (variant: unknown) => {
      const v = variant as Record<string, unknown>;
      if (!v || typeof v !== "object" || Array.isArray(v)) fail(400, "Некоректний розмір.");
      const size = text(v.size, 24).toUpperCase();
      if (
        typeof v.quantity !== "number" || !Number.isSafeInteger(v.quantity) ||
        v.quantity < 0 ||
        v.quantity > 100000
      )
        fail(400, "Залишок має бути цілим невід’ємним числом.");
      return { size, quantity: v.quantity };
    },
  );
  if (new Set(variants.map((v) => v.size)).size !== variants.length)
    fail(400, "Розміри не можуть повторюватися.");
  const db = getRawDb();
  const condition =
    "(SELECT value FROM settings WHERE key='catalog_revision') = ?";
  const statements = [
    db
      .prepare(
        `UPDATE products SET archived=1,active=0 WHERE slug=? AND ${condition}`,
      )
      .bind(slug, String(revision)),
  ];
  for (const variant of variants)
    statements.push(
      db
        .prepare(
          `INSERT INTO products (title,title_en,subtitle,subtitle_en,description,description_en,slug,size,price,price_pending,quantity,category,image,active,is_demo,archived) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0 WHERE ${condition} ON CONFLICT(slug,size) DO UPDATE SET title=excluded.title,title_en=excluded.title_en,subtitle=excluded.subtitle,subtitle_en=excluded.subtitle_en,description=excluded.description,description_en=excluded.description_en,price=excluded.price,price_pending=excluded.price_pending,quantity=excluded.quantity,category=excluded.category,image=excluded.image,active=excluded.active,is_demo=0,archived=0`,
        )
        .bind(
          title,
          titleEn,
          subtitle,
          subtitleEn,
          description,
          descriptionEn,
          slug,
          variant.size,
          input.price || 1,
          input.price === 0 ? 1 : 0,
          variant.quantity,
          input.category,
          image,
          input.active ? 1 : 0,
          String(revision),
        ),
    );
  statements.push(
    db
      .prepare(
        "UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision' AND value=?",
      )
      .bind(String(revision)),
  );
  const results = await db.batch(statements);
  if (!results.at(-1)?.meta.changes)
    fail(
      409,
      "Каталог змінився в іншому вікні. Оновіть список і повторіть зміни.",
    );
  return adminCatalog();
}
