declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MEDIA: R2Bucket;
    ADMIN_SECRET?: string;
    ADMIN_LOGIN?: string;
    ADMIN_INITIAL_CREDENTIAL?: string;
    ADMIN_REQUIRE_MFA?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    NOTIFICATION_SECRET?: string;
    LIVE_ORDERS?: string;
    DEMO_CATALOG?: string;
  }
}
