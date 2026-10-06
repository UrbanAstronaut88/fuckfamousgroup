import { env } from "cloudflare:workers";
import { imageSize } from "image-size";
import {
  sameOrigin,
  requireAdmin,
  rateLimit,
  bodyBytes,
  fail,
  adminResponse,
  adminError,
} from "../../../../lib/admin";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireAdmin(request);
    await rateLimit(request, "upload", 40);
    if (!env.MEDIA) fail(503, "Сховище фотографій ще не підключено.");
    const bytes = await bodyBytes(request, 8 * 1024 * 1024);
    let type = "",
      extension = "";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      type = "image/jpeg";
      extension = "jpg";
    } else if (
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
    ) {
      type = "image/png";
      extension = "png";
    } else if (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    ) {
      type = "image/webp";
      extension = "webp";
    } else fail(400, "Оберіть фото JPEG, PNG або WebP до 8 МБ.");
    try {
      const dimensions = imageSize(bytes);
      if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 40000000)
        fail(400, "Зменште фото до 40 мегапікселів або менше.");
    } catch {
      fail(400, "Фото пошкоджене або перевищує 40 мегапікселів.");
    }
    const key = `${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: {
        contentType: type,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    return adminResponse({ image: `/api/media/${key}` });
  } catch (error) {
    return adminError(error);
  }
}
