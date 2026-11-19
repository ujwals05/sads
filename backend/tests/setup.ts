// Loaded via `node --import` before any test file, i.e. before src/config/env.ts
// parses process.env. dotenv never overrides variables that are already set,
// so these values win over backend/.env.
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret-0123";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-test-refresh-secret-01";
process.env.JWT_ACCESS_EXPIRES = "15m";
process.env.JWT_REFRESH_EXPIRES = "30d";

// Safety net: tests stub every repository, but if a query ever slips
// through it must fail fast instead of reaching the real database.
process.env.DATABASE_URL =
  "postgresql://test:test@127.0.0.1:1/sads_test?connect_timeout=1";
