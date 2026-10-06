export const singleStickerImages = [1, 2, 3].map(n => `/images/merch/sticker-camo-${n}.png`);

// Each PDF page is one independently editable product. Never restore deleted items.
export async function seedSingleStickers(db: D1Database) {
  const marker = "single_stickers_2026_10";
  if (await db.prepare("SELECT value FROM settings WHERE key=?").bind(marker).first()) return;
  await db.batch([
    ...singleStickerImages.map((image, index) => {
      const n = index + 1;
      const slug = `ffg-sticker-camo-${n}`;
      return db.prepare(`INSERT INTO products (slug,title,title_en,subtitle,subtitle_en,description,description_en,image,category,size,price,price_pending,quantity,active,is_demo,archived)
        SELECT ?,?,?,?,?,?,?,?,'sticker','УТОЧНЮЄТЬСЯ',1,1,0,1,0,0
        WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) AND NOT EXISTS (SELECT 1 FROM products WHERE slug=?)`)
        .bind(slug, `Стікер «Воля або смерть» — Camo ${n}`, `Freedom or Death Sticker — Camo ${n}`,
          "1 стікер · продається окремо", "1 sticker · sold individually",
          `Стікер із символікою FCK Famous Group. Камуфляжний варіант ${n}. Продається поштучно.`,
          `FCK Famous Group emblem sticker. Camouflage variant ${n}. Sold individually.`, image, marker, slug);
    }),
    db.prepare("INSERT INTO settings (key,value) SELECT 'catalog_revision','1' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1").bind(marker),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?, '1')").bind(marker),
  ]);
}
