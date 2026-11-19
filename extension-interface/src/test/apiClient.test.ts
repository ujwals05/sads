import * as assert from 'assert';
import { ApiClient, ApiClientError } from '../backend/apiClient';

// ApiClient has no `vscode` dependency, so this suite also runs under plain mocha.
suite('ApiClient', () => {
  const realFetch = globalThis.fetch;
  let requested: string[] = [];

  setup(() => {
    requested = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      requested.push(String(input));
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as typeof fetch;
  });

  teardown(() => {
    globalThis.fetch = realFetch;
  });

  test('keeps query strings out of the path (user search regression)', async () => {
    const client = new ApiClient(() => 'http://localhost:5001');
    await client.get('/users/search?q=alice%40x.dev&page=1&workspaceId=abc');
    assert.strictEqual(
      requested[0],
      'http://localhost:5001/api/v1/users/search?q=alice%40x.dev&page=1&workspaceId=abc',
    );
  });

  test('builds plain paths and respects an /api/v1 base URL', async () => {
    const client = new ApiClient(() => 'http://localhost:5001/api/v1/');
    await client.get('/workspaces');
    assert.strictEqual(requested[0], 'http://localhost:5001/api/v1/workspaces');
  });

  test('rejects path traversal', async () => {
    const client = new ApiClient(() => 'http://localhost:5001');
    await assert.rejects(
      client.get('/workspaces/../auth/me'),
      (error: unknown) => error instanceof ApiClientError && error.code === 'INVALID_API_PATH',
    );
  });

  test('surfaces backend error codes', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Nope' } }),
        { status: 403 },
      )) as typeof fetch;
    const client = new ApiClient(() => 'http://localhost:5001');
    await assert.rejects(
      client.get('/workspaces/x'),
      (error: unknown) =>
        error instanceof ApiClientError && error.status === 403 && error.code === 'FORBIDDEN',
    );
  });
});
