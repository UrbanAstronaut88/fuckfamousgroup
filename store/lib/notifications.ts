export type TelegramConfig = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};
export async function deliverNotification(
  db: D1Database,
  config: TelegramConfig,
  id: string,
  send: typeof fetch = fetch,
) {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) return false;
  const now = Date.now();
  const claim = await db
    .prepare(
      "UPDATE notifications SET status='sending',lock_until=?,attempts=attempts+1 WHERE order_id=? AND status IN ('pending','sending') AND next_attempt<=? AND lock_until<? RETURNING attempts",
    )
    .bind(now + 60000, id, now, now)
    .first<{ attempts: number }>();
  if (!claim) return false;
  try {
    const order = await db
      .prepare("SELECT name,phone FROM orders WHERE id=?")
      .bind(id)
      .first<{ name: string; phone: string }>();
    if (!order) throw Error("Missing order");
    const { results: items } = await db
      .prepare(
        "SELECT title,size,quantity,price FROM order_items WHERE order_id=? ORDER BY id",
      )
      .bind(id)
      .all<{ title: string; size: string; quantity: number; price: number }>();
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const text = `FFG — нова заявка #${id.slice(0, 8).toUpperCase()}\n\nІм’я: ${order.name}\nТелефон: ${order.phone}\n\n${items.map((i) => `${i.title} / ${i.size} × ${i.quantity} — ${i.price * i.quantity} ₴`).join("\n")}\n\nРазом: ${total} ₴ (без доставки)\nОплата не здійснювалась. Товари зарезервовано.\nID: ${id}`;
    const response = await send(
      `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = (await response.json()) as {
      ok?: boolean;
      result?: { message_id: number };
    };
    if (!response.ok || !result.ok)
      throw Error("Telegram rejected notification");
    await db
      .prepare(
        "UPDATE notifications SET status='sent',lock_until=0,last_error=NULL,message_id=? WHERE order_id=? AND status='sending'",
      )
      .bind(result.result?.message_id ?? null, id)
      .run();
    return true;
  } catch {
    // Do not log Telegram request URLs: the URL contains the bot secret.
    await db
      .prepare(
        "UPDATE notifications SET status='pending',lock_until=0,next_attempt=?,last_error='delivery_failed' WHERE order_id=? AND status='sending'",
      )
      .bind(
        now + Math.min(3600000, 30000 * 2 ** Math.min(claim.attempts, 7)),
        id,
      )
      .run();
    return false;
  }
}
export async function retryNotifications(
  db: D1Database,
  config: TelegramConfig,
) {
  const now = Date.now();
  const { results } = await db
    .prepare(
      "SELECT order_id FROM notifications WHERE status IN ('pending','sending') AND next_attempt<=? AND lock_until<? ORDER BY next_attempt LIMIT 20",
    )
    .bind(now, now)
    .all<{ order_id: string }>();
  let delivered = 0;
  for (const n of results)
    if (await deliverNotification(db, config, n.order_id)) delivered++;
  return { checked: results.length, delivered };
}
