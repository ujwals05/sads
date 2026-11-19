export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class ApiClient {
  private accessToken: string | null = null;

  constructor(
    private readonly getConfiguredBaseUrl: () => string,
  ) {}

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  clearAccessToken(): void {
    this.accessToken = null;
  }

  async get<T>(
    path: string,
    options?: Omit<ApiRequestOptions, "body">,
  ): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async post<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "body">,
  ): Promise<T> {
    return this.request<T>("POST", path, {
      ...options,
      body,
    });
  }

  async patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "body">,
  ): Promise<T> {
    return this.request<T>("PATCH", path, {
      ...options,
      body,
    });
  }

  async delete<T>(
    path: string,
    options?: Omit<ApiRequestOptions, "body">,
  ): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  private async request<T>(
    method: string,
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path);
    const headers = new Headers(options.headers);

    headers.set("Accept", "application/json");

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (this.accessToken) {
      headers.set(
        "Authorization",
        `Bearer ${this.accessToken}`,
      );
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers,
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        signal: options.signal ?? AbortSignal.timeout(10_000),
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "TimeoutError"
      ) {
        throw new ApiClientError(
          "The backend request timed out.",
          0,
          "REQUEST_TIMEOUT",
        );
      }

      throw new ApiClientError(
        error instanceof Error
          ? `Unable to reach the backend: ${error.message}`
          : "Unable to reach the backend.",
        0,
        "NETWORK_ERROR",
      );
    }

    const responseText = await response.text();

    let payload: unknown;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        if (response.ok) {
          throw new ApiClientError(
            "The backend returned an invalid JSON response.",
            response.status,
            "INVALID_RESPONSE",
          );
        }
      }
    }

    if (!response.ok) {
      const errorBody = payload as ApiErrorBody | undefined;

      throw new ApiClientError(
        errorBody?.error?.message ??
          `Backend request failed with HTTP ${response.status}.`,
        response.status,
        errorBody?.error?.code,
      );
    }

    return payload as T;
  }

  private buildUrl(path: string): string {
    const configuredUrl = this.getConfiguredBaseUrl().trim();

    let baseUrl: URL;

    try {
      baseUrl = new URL(configuredUrl);
    } catch {
      throw new ApiClientError(
        "The configured SADS backend URL is invalid.",
        0,
        "INVALID_BACKEND_URL",
      );
    }

    if (
      baseUrl.protocol !== "http:" &&
      baseUrl.protocol !== "https:"
    ) {
      throw new ApiClientError(
        "The backend URL must use HTTP or HTTPS.",
        0,
        "INVALID_BACKEND_URL",
      );
    }

    if (baseUrl.username || baseUrl.password) {
      throw new ApiClientError(
        "Do not include credentials in the backend URL.",
        0,
        "INVALID_BACKEND_URL",
      );
    }

    const basePath = baseUrl.pathname.replace(/\/+$/, "");
    const apiPrefix = basePath.endsWith("/api/v1")
      ? ""
      : "/api/v1";

    // Split off the query string. Assigning "?" to URL.pathname would
    // percent-encode it into the path (e.g. "/users/search%3Fq=..."),
    // which previously broke every request that carried query parameters.
    const queryIndex = path.indexOf("?");
    const rawPath = queryIndex === -1 ? path : path.slice(0, queryIndex);
    const rawQuery = queryIndex === -1 ? "" : path.slice(queryIndex + 1);

    const normalizedPath = rawPath.startsWith("/")
      ? rawPath
      : `/${rawPath}`;

    if (
      normalizedPath.includes("#") ||
      normalizedPath.includes("..") ||
      rawQuery.includes("#")
    ) {
      throw new ApiClientError(
        "Invalid API path.",
        0,
        "INVALID_API_PATH",
      );
    }

    baseUrl.pathname =
      `${basePath}${apiPrefix}${normalizedPath}`.replace(
        /\/+/, "/",
      );

    baseUrl.search = rawQuery ? `?${rawQuery}` : "";
    baseUrl.hash = "";

    return baseUrl.toString();
  }
}
