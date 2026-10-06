export class OrderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Input = {
  name: string;
  phone: string;
  consent: true;
  items: { id: number; quantity: number }[];
};
export function validateOrder(raw: unknown): Input {
  if (!raw || typeof raw !== "object")
    throw new OrderError(400, "Некоректна заявка.");
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (
    name.length < 2 ||
    name.length > 80 ||
    /[\u0000-\u001f\u007f]/u.test(name)
  )
    throw new OrderError(400, "Вкажіть ім’я: від 2 до 80 символів.");
  let phone =
    typeof r.phone === "string" ? r.phone.replace(/[\s()\-]/g, "") : "";
  if (/^0\d{9}$/.test(phone)) phone = "+38" + phone;
  if (/^380\d{9}$/.test(phone)) phone = "+" + phone;
  if (!/^\+[1-9]\d{9,14}$/.test(phone))
    throw new OrderError(
      400,
      "Вкажіть номер у міжнародному форматі, наприклад +380501234567.",
    );
  if (r.consent !== true)
    throw new OrderError(400, "Потрібна згода на обробку контактних даних.");
  if (!Array.isArray(r.items) || r.items.length < 1 || r.items.length > 20)
    throw new OrderError(400, "Додайте від 1 до 20 позицій.");
  const ids = new Set<number>();
  const items = r.items
    .map((item: unknown) => {
      if (!item || typeof item !== "object")
        throw new OrderError(400, "Некоректний товар.");
      const i = item as { id: number; quantity: number };
      if (
        !Number.isSafeInteger(i.id) ||
        i.id < 1 ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 10 ||
        ids.has(i.id)
      )
        throw new OrderError(
          400,
          "Кількість кожного товару має бути від 1 до 10. Позиції не мають повторюватися.",
        );
      ids.add(i.id);
      return { id: i.id, quantity: i.quantity };
    })
    .sort((a, b) => a.id - b.id);
  return { name, phone, consent: true, items };
}
export async function createOrder(db: D1Database, raw: unknown, key: string) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      key,
    )
  )
    throw new OrderError(400, "Оновіть сторінку та спробуйте ще раз.");
  const input = validateOrder(raw);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(input)),
  );
  const hash = Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  async function existing() {
    const old = await db
      .prepare("SELECT payload_hash FROM orders WHERE id=?")
      .bind(key)
      .first<{ payload_hash: string }>();
    if (old && old.payload_hash !== hash)
      throw new OrderError(
        409,
        "Заявка вже змінена. Оновіть кошик перед повторним замовленням.",
      );
    return !!old;
  }
  if (await existing()) return { orderId: key, replayed: true };
  const placeholders = input.items.map(() => "?").join(",");
  const { results: products } = await db
    .prepare(
      `SELECT id,title,size,price,quantity FROM products WHERE active=1 AND id IN (${placeholders})`,
    )
    .bind(...input.items.map((i) => i.id))
    .all<{
      id: number;
      title: string;
      size: string;
      price: number;
      quantity: number;
    }>();
  const now = Date.now();
  const statements = [
    db
      .prepare(
        "INSERT INTO orders (id,payload_hash,name,phone,created_at,consented_at) VALUES (?,?,CASE WHEN (SELECT count(*) FROM orders WHERE phone=? AND created_at>?)<3 THEN ? ELSE NULL END,?,?,?)",
      )
      .bind(
        key,
        hash,
        input.phone,
        now - 900000,
        input.name,
        input.phone,
        now,
        now,
      ),
  ];
  for (const item of input.items) {
    const p = products.find((p) => p.id === item.id);
    if (!p || p.quantity < item.quantity)
      throw new OrderError(
        409,
        "Недостатньо товару в наявності. Оновіть кількість у кошику.",
      );
    statements.push(
      db
        .prepare(
          "UPDATE products SET quantity=quantity-? WHERE id=? AND active=1 AND price=?",
        )
        .bind(item.quantity, p.id, p.price),
      db
        .prepare(
          "INSERT INTO order_items (order_id,product_id,title,size,quantity,price) VALUES (?,?,?,?,?,(SELECT price FROM products WHERE id=? AND active=1 AND price=?))",
        )
        .bind(key, p.id, p.title, p.size, item.quantity, p.id, p.price),
    );
  }
  statements.push(
    db.prepare("INSERT INTO notifications (order_id) VALUES (?)").bind(key),
  );
  try {
    await db.batch(statements);
  } catch (e) {
    // A concurrent identical request can win; replay never reserves inventory twice.
    if (await existing()) return { orderId: key, replayed: true };
    const message = e instanceof Error ? e.message : "";
    if (message.includes("orders.name"))
      throw new OrderError(429, "Забагато заявок. Спробуйте через 15 хвилин.");
    if (
      message.includes("stock_nonnegative") ||
      message.includes("order_items.price")
    )
      throw new OrderError(409, "Наявність або ціна змінилися. Оновіть кошик.");
    throw new OrderError(
      503,
      "Не вдалося зберегти заявку. Спробуйте ще раз — дубль не створиться.",
    );
  }
  return { orderId: key, replayed: false };
}

export async function cancelOrder(db: D1Database, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id))
    throw new OrderError(400, "Некоректний ID заявки.");
  const order = await db
    .prepare("SELECT id FROM orders WHERE id=?")
    .bind(id)
    .first();
  if (!order) throw new OrderError(404, "Заявку не знайдено.");
  await db.batch([
    db
      .prepare(
        "UPDATE products SET quantity=quantity+(SELECT quantity FROM order_items WHERE order_id=? AND product_id=products.id) WHERE id IN (SELECT product_id FROM order_items WHERE order_id=?) AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status!='cancelled')",
      )
      .bind(id, id, id),
    db
      .prepare(
        "UPDATE notifications SET status='cancelled' WHERE order_id=? AND status!='sent'",
      )
      .bind(id),
    db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(id),
  ]);
  return { orderId: id, status: "cancelled" };
}
