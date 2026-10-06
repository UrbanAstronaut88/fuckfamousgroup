// One-time owner-requested catalog release. Admin edits and deletions are never reseeded.
export const hoodieImages = [
  "/images/merch/ffg-gbc-brown.png", "/images/merch/ffg-gbc-pink.png",
  "/images/merch/ffg-gbc-black.png", "/images/merch/ffg-sand.png",
  "/images/merch/ffg-gray.png", "/images/merch/ffg-black.png",
];
const models = [
  ["ffg-gbc-brown", "Худі FFG × GBC — коричневе", "FFG × GBC Hoodie — Brown", "Коричневий", "Brown"],
  ["ffg-gbc-pink", "Худі FFG × GBC — рожеве", "FFG × GBC Hoodie — Pink", "Рожевий", "Pink"],
  ["ffg-gbc-black", "Худі FFG × GBC — чорне", "FFG × GBC Hoodie — Black", "Чорний", "Black"],
  ["ffg-sand", "Худі FCK Famous — пісочне", "FCK Famous Hoodie — Sand", "Пісочний", "Sand"],
  ["ffg-gray", "Худі FCK Famous — сіре", "FCK Famous Hoodie — Grey", "Сірий", "Grey"],
  ["ffg-black", "Худі FCK Famous — чорне", "FCK Famous Hoodie — Black", "Чорний", "Black"],
];
export async function seedHoodieRelease(db: D1Database) {
  const marker = "hoodie_release_2026_09";
  if (await db.prepare("SELECT value FROM settings WHERE key=?").bind(marker).first()) return;
  await db.batch([
    ...models.map(([slug, title, titleEn, subtitle, subtitleEn], i) => db.prepare(
      `INSERT INTO products (slug,title,title_en,subtitle,subtitle_en,description,description_en,image,category,size,price,price_pending,quantity,active,is_demo,archived)
       SELECT ?,?,?,?,?,?,?,?,'hoodie','УТОЧНЮЄТЬСЯ',1,1,0,1,0,0
       WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) AND NOT EXISTS (SELECT 1 FROM products WHERE slug=?)`,
    ).bind(slug, title, titleEn, subtitle, subtitleEn,
      "Худі з символікою FCK Famous Group. Розміри, склад, ціну та наявність уточнюйте у менеджера.",
      "FCK Famous Group hoodie. Ask our manager about sizes, fabric, price and availability.",
      hoodieImages[i], marker, slug)),
    db.prepare("INSERT INTO settings (key,value) SELECT 'catalog_revision','1' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1").bind(marker),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?, '1')").bind(marker),
  ]);
}
