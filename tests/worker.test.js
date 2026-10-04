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

test('returns a clear setup response when the API secret is missing', async () => {
  const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
    method: 'POST',
    headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Quais aves estão disponíveis?' }] })
  }), {});

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'chat_not_configured' });
});

test('rejects methods other than POST for the chat endpoint', async () => {
  const response = await worker.fetch(new Request('https://passarinhosfontelonga.pt/api/chat', {
    method: 'GET',
    headers: { Origin: allowedOrigin }
  }), {});

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: 'method_not_allowed' });
});