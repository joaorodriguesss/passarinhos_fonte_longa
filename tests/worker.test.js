import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const allowedOrigin = 'https://passarinhosfontelonga.pt';

test('serves non-API requests through the static assets binding', async () => {
  const response = await worker.fetch(
    new Request('https://passarinhosfontelonga.pt/'),
    { ASSETS: { fetch: async () => new Response('site asset') } }
  );

  assert.equal(await response.text(), 'site asset');
});

test('rejects chat requests from unknown origins', async () => {
  const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
    method: 'POST',
    headers: { Origin: 'https://invalid.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] })
  }), {});

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'origin_not_allowed' });
});

test('allows chat requests from a local Wrangler port', async () => {
  const origin = 'http://127.0.0.1:8790';
  const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] })
  }), {});

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.deepEqual(await response.json(), { error: 'chat_not_configured' });
});

test('returns a clear setup response when the API secret is missing', async () => {
  const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
    method: 'POST',
    headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Quais aves estão disponíveis?' }] })
  }), {});

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'chat_not_configured' });
});

test('logs upstream errors and exposes safe diagnostics only locally', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  let loggedDetails;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      message: 'The API key is invalid',
      type: 'invalid_request_error',
      code: 'invalid_api_key'
    }
  }), {
    status: 401,
    headers: { 'x-request-id': 'req_test' }
  });
  console.error = (message, details) => {
    loggedDetails = { message, details };
  };

  try {
    const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
      method: 'POST',
      headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] })
    }), { OPENAI_API_KEY: 'test-secret' });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'model_unavailable' });
    assert.deepEqual(loggedDetails, {
      message: 'OpenAI Responses API request failed',
      details: {
        status: 401,
        code: 'invalid_api_key',
        type: 'invalid_request_error',
        param: undefined,
        requestId: 'req_test'
      }
    });
    assert.equal(JSON.stringify(loggedDetails).includes('test-secret'), false);

    const localOrigin = 'http://127.0.0.1:8790';
    const localResponse = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
      method: 'POST',
      headers: { Origin: localOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] })
    }), { OPENAI_API_KEY: 'test-secret' });

    assert.deepEqual(await localResponse.json(), {
      error: 'model_unavailable',
      diagnostic: {
        status: 401,
        code: 'invalid_api_key',
        type: 'invalid_request_error',
        requestId: 'req_test'
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('exposes safe response-shape diagnostics for empty output locally', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'refusal', refusal: 'Private response text' }] }
    ]
  }), { status: 200 });
  console.error = () => {};

  try {
    const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:8790', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] })
    }), { OPENAI_API_KEY: 'test-secret' });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'empty_model_response',
      diagnostic: {
        responseStatus: 'incomplete',
        outputTypes: ['reasoning', 'message'],
        contentTypes: ['refusal'],
        incompleteReason: 'max_output_tokens'
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('rejects methods other than POST for the chat endpoint', async () => {
  const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
    method: 'GET',
    headers: { Origin: allowedOrigin }
  }), {});

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: 'method_not_allowed' });
});