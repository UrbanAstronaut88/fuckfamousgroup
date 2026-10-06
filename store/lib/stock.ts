import { type Product } from "./catalog";
// Archive demo models once, preserving historical references and admin concurrency.
export async function retireDemo(db: D1Database) {
  const marker = "demo_retired_2026_09";
  if (await db.prepare("SELECT value FROM settings WHERE key=?").bind(marker).first()) return;
  await db.batch([
    db.prepare("UPDATE products SET archived=1,active=0 WHERE is_demo=1 AND NOT EXISTS (SELECT 1 FROM settings WHERE key=?)").bind(marker),
    db.prepare("INSERT INTO settings (key,value) SELECT 'catalog_revision','1' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key=?) ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1").bind(marker),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?, '1')").bind(marker),
  ]);
}
export async function listProducts(db: D1Database): Promise<Product[]> {
  const result = await db
    .prepare(
      "SELECT id,title,quantity,slug,size,price,price_pending AS pricePending,subtitle,description,image,category,title_en AS titleEn,subtitle_en AS subtitleEn,description_en AS descriptionEn,is_demo AS isDemo FROM products WHERE active=1 AND archived=0 ORDER BY is_demo, id",
    )
    .all<Product>();
  return result.results;
}
