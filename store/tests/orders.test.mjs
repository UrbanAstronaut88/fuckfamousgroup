import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { Miniflare } from "miniflare";

async function source(path) {
  const code = ts.transpileModule(
    await readFile(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
}
const { createOrder, validateOrder, cancelOrder } =
  await source("../lib/orders.ts");
const { deliverNotification } = await source("../lib/notifications.ts");
const schema = await readFile(
  new URL("../drizzle/0000_amusing_mercury.sql", import.meta.url),
  "utf8",
);
const cancellationSchema = await readFile(
  new URL("../drizzle/0001_cancel_pending_notifications.sql", import.meta.url),
  "utf8",
);
const input = (items = [{ id: 1, quantity: 1 }]) => ({
  name: "Тестовий покупець",
  phone: "+380501234567",
  consent: true,
  items,
});

test("Orders use D1 transactions and a durable notification queue", async (t) => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test")}}',
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "test" },
  });
  try {
    const db = await mf.getD1Database("DB");
    await db.batch(
      schema
        .split("--> statement-breakpoint")
        .map((s) => db.prepare(s.trim()))
        .filter(Boolean),
    );
    await db.batch(
      cancellationSchema
        .split("--> statement-breakpoint")
        .map((s) => db.prepare(s.trim())),
    );
    await db
      .prepare(
        "INSERT INTO products (id,title,quantity,slug,size,price,subtitle,description,image,category) VALUES (1,'T-shirt',2,'tee','M',1200,'Black','Demo','/test.png','tshirt'),(2,'Cap',1,'cap','ONE SIZE',750,'Black','Demo','/test.png','accessory')",
      )
      .run();
    const qty = async (id) =>
      (
        await db
          .prepare("SELECT quantity FROM products WHERE id=?")
          .bind(id)
          .first()
      ).quantity;
    let orderId;
    await t.test(
      "two simultaneous buyers cannot both buy the last item",
      async () => {
        const outcomes = await Promise.allSettled([
          createOrder(db, input([{ id: 2, quantity: 1 }]), crypto.randomUUID()),
          createOrder(
            db,
            { ...input([{ id: 2, quantity: 1 }]), phone: "+380501234568" },
            crypto.randomUUID(),
          ),
        ]);
        assert.equal(
          outcomes.filter((r) => r.status === "fulfilled").length,
          1,
        );
        assert.equal(
          outcomes.filter(
            (r) => r.status === "rejected" && r.reason.status === 409,
          ).length,
          1,
        );
        assert.equal(await qty(2), 0);
      },
    );
    await t.test(
      "duplicate requests reserve only once and client price is ignored",
      async () => {
        orderId = crypto.randomUUID();
        const body = { ...input(), price: 1, total: 1 };
        const results = await Promise.all([
          createOrder(db, body, orderId),
          createOrder(db, body, orderId),
        ]);
        assert.ok(results.some((r) => r.replayed));
        assert.equal(await qty(1), 1);
        const item = await db
          .prepare("SELECT price FROM order_items WHERE order_id=?")
          .bind(orderId)
          .first();
        assert.equal(item.price, 1200);
        await assert.rejects(
          () => createOrder(db, { ...body, name: "Інше ім’я" }, orderId),
          { status: 409 },
        );
      },
    );
    await t.test(
      "failure in a later line rolls back the entire D1 batch",
      async () => {
        const id = crypto.randomUUID();
        await db.prepare("UPDATE products SET quantity=1 WHERE id=2").run();
        const racedDb = {
          prepare: db.prepare.bind(db),
          batch: async (statements) => {
            await db.prepare("UPDATE products SET quantity=0 WHERE id=2").run();
            return db.batch(statements);
          },
        };
        await assert.rejects(
          () =>
            createOrder(
              racedDb,
              {
                ...input([
                  { id: 1, quantity: 1 },
                  { id: 2, quantity: 1 },
                ]),
                phone: "+380501234569",
              },
              id,
            ),
          { status: 409 },
        );
        assert.equal(await qty(1), 1);
        assert.equal(
          await db.prepare("SELECT id FROM orders WHERE id=?").bind(id).first(),
          null,
        );
      },
    );
    await t.test(
      "Telegram failure leaves order reserved and notification pending",
      async () => {
        const sent = await deliverNotification(
          db,
          { TELEGRAM_BOT_TOKEN: "test", TELEGRAM_CHAT_ID: "test" },
          orderId,
          async () => new Response('{"ok":false}', { status: 503 }),
        );
        assert.equal(sent, false);
        assert.equal(await qty(1), 1);
        const notification = await db
          .prepare("SELECT status,attempts FROM notifications WHERE order_id=?")
          .bind(orderId)
          .first();
        assert.equal(notification.status, "pending");
        assert.equal(notification.attempts, 1);
      },
    );
    await t.test(
      "retry sends the saved name, phone, sizes and server total",
      async () => {
        await db
          .prepare("UPDATE notifications SET next_attempt=0 WHERE order_id=?")
          .bind(orderId)
          .run();
        let payload;
        const sent = await deliverNotification(
          db,
          { TELEGRAM_BOT_TOKEN: "test", TELEGRAM_CHAT_ID: "test" },
          orderId,
          async (_url, options) => {
            payload = JSON.parse(options.body);
            return new Response('{"ok":true,"result":{"message_id":42}}');
          },
        );
        assert.equal(sent, true);
        assert.match(payload.text, /Тестовий покупець/);
        assert.match(payload.text, /\+380501234567/);
        assert.match(payload.text, /1200 ₴/);
        assert.equal(payload.parse_mode, undefined);
        assert.equal(
          (
            await db
              .prepare("SELECT status FROM notifications WHERE order_id=?")
              .bind(orderId)
              .first()
          ).status,
          "sent",
        );
      },
    );
    await t.test("cancellation restores inventory exactly once", async () => {
      await cancelOrder(db, orderId);
      assert.equal(await qty(1), 2);
      await Promise.all([cancelOrder(db, orderId), cancelOrder(db, orderId)]);
      assert.equal(await qty(1), 2);
    });
    await t.test(
      "invalid quantities, duplicated products, contacts and missing consent fail",
      () => {
        for (const body of [
          input([{ id: 1, quantity: -1 }]),
          input([{ id: 1, quantity: 0 }]),
          input([{ id: 1, quantity: 1.5 }]),
          input([
            { id: 1, quantity: 1 },
            { id: 1, quantity: 1 },
          ]),
          { ...input(), phone: "bad" },
          { ...input(), consent: false },
          input([]),
        ])
          assert.throws(() => validateOrder(body));
        assert.equal(
          validateOrder({ ...input(), phone: "050 123 45 67" }).phone,
          "+380501234567",
        );
      },
    );
    await t.test(
      "cancelling an undelivered order also cancels its notification",
      async () => {
        const id = crypto.randomUUID();
        await createOrder(db, { ...input(), phone: "+380501234599" }, id);
        await cancelOrder(db, id);
        let calls = 0;
        assert.equal(
          await deliverNotification(
            db,
            { TELEGRAM_BOT_TOKEN: "test", TELEGRAM_CHAT_ID: "test" },
            id,
            async () => {
              calls++;
              return new Response("{}");
            },
          ),
          false,
        );
        assert.equal(calls, 0);
        assert.equal(await qty(1), 2);
      },
    );
  } finally {
    await mf.dispose();
  }
});
