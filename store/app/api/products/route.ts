import { getRawDb } from "../../../db";
import { retireDemo, listProducts } from "../../../lib/stock";
import { checkoutEnabled } from "../../../lib/config";
import { seedHoodieRelease } from "../../../lib/hoodie-release";
import { seedStickerRelease } from "../../../lib/sticker-release";
import { seedSingleStickers } from "../../../lib/single-sticker-release";
export async function GET() {
  try {
    const db = getRawDb();
    await retireDemo(db);
    await seedHoodieRelease(db);
    await seedStickerRelease(db);
    await seedSingleStickers(db);
    return Response.json(
      { products: await listProducts(db), checkoutEnabled: checkoutEnabled() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Catalog storage unavailable");
    return Response.json(
      { error: "Каталог тимчасово недоступний." },
      { status: 503 },
    );
  }
}
