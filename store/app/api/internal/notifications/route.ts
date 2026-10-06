export async function POST() {
  return Response.json(
    {
      error:
        "Автоматичну відправку заявок вимкнено. Замовлення приймає менеджер напряму.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
