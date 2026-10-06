export async function POST() {
  return Response.json({ error: "Замовлення на сайті вимкнено." }, { status: 410 });
}
