
import "dotenv/config";
import { z } from "zod";
import type { StringValue } from "ms";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  HOST: z.string().default("127.0.0.1"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  SUPABASE_URL: z.string().url(),

  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  JWT_ACCESS_EXPIRES: z.custom<StringValue>(
    (val) => typeof val === "string"
  ),

  JWT_REFRESH_EXPIRES: z.custom<StringValue>(
    (val) => typeof val === "string"
  ),
});

export const env = envSchema.parse(process.env);
