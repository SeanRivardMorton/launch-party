declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    BETTER_AUTH_SECRET?: string
    BETTER_AUTH_URL?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    RESEND_API_KEY?: string
    AUTH_EMAIL_FROM?: string
    GUILD_CAMPFIRES: DurableObjectNamespace
    AVATAR_JOBS: DurableObjectNamespace
    AVATAR_BUCKET: R2Bucket
    OPENAI_API_KEY?: string
    AVATAR_GENERATION_ENABLED?: string
  }
}
