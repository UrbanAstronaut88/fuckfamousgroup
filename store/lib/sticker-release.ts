export const stickerImage = "/images/merch/sticker-pack.jpg";

// Import this owner-provided product once; never undo later admin edits/deletion.
export async function seedStickerRelease(db: D1Database) {
  const marker = "sticker_release_2026_09";
  if (await db.prepare("SELECT value FROM settings WHERE key=?").bind(marker).first()) return;
  await db.batch([
    db.prepare(`INSERT INTO products (slug,title,title_en,subtitle,subtitle_en,description,description_en,image,category,size,price,price_pending,quantity,active,is_demo,archived)
      SELECT 'ffg-sticker-pack',?,?,?,?,?,? ,?,'sticker','10 × 15 CM',1,1,0,1,0,0
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) AND NOT EXISTS (SELECT 1 FROM products WHERE slug='ffg-sticker-pack')`)
      .bind("Стікерпак FCK Famous Group", "FCK Famous Group Sticker Pack",
        "1 аркуш · 10 × 15 см · 6 стікерів", "1 sheet · 10 × 15 cm · 6 stickers",
        "Один аркуш формату 10 × 15 см із шістьма стікерами FCK Famous Group. Продається цілим аркушем. Ціну та наявність уточнюйте у менеджера.",
        "One 10 × 15 cm sheet with six FCK Famous Group stickers. Sold as a complete sheet. Ask our manager about price and availability.",
        stickerImage, marker),
    db.prepare("INSERT INTO settings (key,value) SELECT 'catalog_revision','1' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1").bind(marker),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?, '1')").bind(marker),
  ]);
}
