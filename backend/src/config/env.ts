
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

  // AI coding agent. ANTHROPIC_API_KEY is read by the Anthropic SDK itself;
  // it is optional here so the rest of the API can run without it.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AGENT_MODEL: z.string().min(1).default("claude-opus-5-5"),
  AGENT_EFFORT: z
    .enum(["low", "medium", "high", "xhigh", "max"])
    .default("high"),
  AGENT_MAX_TOKENS: z.coerce.number().int().min(1024).max(128000).default(64000),
  // Upper bound on model calls in a single task, to stop runaway loops.
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(500).default(50),
});

export const env = envSchema.parse(process.env);
