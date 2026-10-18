
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  HOST: z.string().default("127.0.0.1"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  SUPABASE_URL: z.string().url(),

  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
