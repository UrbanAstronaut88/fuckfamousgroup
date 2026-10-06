import { env } from "cloudflare:workers";
export async function GET(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
    return new Response("Not found", { status: 404 });
  try {
    const object = await env.MEDIA?.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      ETag: object.httpEtag,
    });
    object.writeHttpMetadata(headers);
    if (request.headers.get("If-None-Match") === object.httpEtag)
      return new Response(null, { status: 304, headers });
    return new Response(object.body, { headers });
  } catch {
    return new Response("Media unavailable", { status: 503 });
  }
}
