import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../src/app.js";
import { signAccessToken } from "../../src/utils/jwt.js";

export interface TestResponse {
  status: number;
  body: any;
}

export async function startTestServer() {
  // A fresh app per suite also gives a fresh in-memory rate limiter.
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  async function request(
    method: string,
    path: string,
    options: { token?: string; body?: unknown; rawBody?: string } = {},
  ): Promise<TestResponse> {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let body: string | undefined;
    if (options.rawBody !== undefined) {
      body = options.rawBody;
      headers["Content-Type"] = "application/json";
    } else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${baseUrl}${path}`, { method, headers, body });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  return {
    request,
    tokenFor(user: { id: string; email: string }) {
      return signAccessToken({ id: user.id, email: user.email });
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
