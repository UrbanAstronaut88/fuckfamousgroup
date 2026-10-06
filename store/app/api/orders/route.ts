export async function POST() {
  return Response.json(
    {
      error:
        "Замовлення на сайті вимкнено. Напишіть менеджеру в Instagram або Telegram.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
