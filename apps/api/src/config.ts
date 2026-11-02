import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().url().default('http://localhost:8030'),
    API_PORT: z.coerce.number().int().default(8130),
    API_HOST: z.string().default('127.0.0.1'),
    /** Which proxies to trust for the client IP (Express syntax). Docker: 'loopback, uniquelocal'. */
    TRUST_PROXY: z.string().default('loopback'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379/14'),
    REDIS_PREFIX: z.string().regex(/^[a-z0-9-]+$/).default('openlet'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    SIGNUP_ENABLED: bool,
    DEMO_MODE: bool,
    MAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
    MAIL_FROM: z.string().default('OpenLet <no-reply@example.com>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: bool,
    STORAGE_DIR: z.string().default('./storage'),
    UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(15),
    CONTRACTOR_LINK_GRACE_DAYS: z.coerce.number().int().min(0).max(90).default(7),
  })
  .refine((c) => c.NODE_ENV !== 'production' || c.COOKIE_SECURE, {
    path: ['COOKIE_SECURE'],
    message: 'COOKIE_SECURE must be true in production',
  })
  .refine((c) => c.MAIL_TRANSPORT !== 'smtp' || !!c.SMTP_HOST, {
    path: ['SMTP_HOST'],
    message: 'SMTP_HOST is needed when MAIL_TRANSPORT=smtp',
  })
  .transform((c) => ({
    ...c,
    // The demo never sends email and never opens sign-up.
    SIGNUP_ENABLED: c.DEMO_MODE ? false : c.SIGNUP_ENABLED,
    UPLOAD_MAX_BYTES: (c.DEMO_MODE ? 2 : c.UPLOAD_MAX_MB) * 1024 * 1024,
  }));

export type Config = z.infer<typeof envSchema>;

let cached: Config | undefined;

export function config(): Config {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new Error(`Invalid environment:\n${issues.join('\n')}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Tests change env between files. */
export function resetConfig() {
  cached = undefined;
}
