import chatConfig from './chat-config.json' with { type: 'json' };
import knowledgeBase from './chat-knowledge.json' with { type: 'json' };
import { buildInstructions, retrieveKnowledge } from './chat-core.js';

const requestWindows = new Map();
let cachedInventory = null;
let inventoryCachedAt = 0;

function jsonResponse(body, status, origin) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigins(env) {
  return new Set([
    'https://passarinhosfontelonga.pt',
    'https://www.passarinhosfontelonga.pt',
    'https://passarinhos-fonte-longa.rodriguesjoao265ar.workers.dev',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    ...(env.CHAT_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
  ]);
}

function isLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname) &&
      Boolean(url.port);
  } catch {
    return false;
  }
}

function limitedByIp(request) {
  const now = Date.now();
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  let window = requestWindows.get(ip);
  if (!window || now - window.startedAt >= 60_000) {
    window = { startedAt: now, count: 0 };
    requestWindows.set(ip, window);
  }
  window.count += 1;

  if (requestWindows.size > 1000) {
    for (const [key, value] of requestWindows) {
      if (now - value.startedAt >= 60_000) requestWindows.delete(key);
    }
  }

  return window.count > 8;
}

async function readLimitedBody(request, maxBytes) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function getAvailableBirds(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  if (cachedInventory && Date.now() - inventoryCachedAt < 30_000) return cachedInventory;

  const url = new URL('/rest/v1/birds', env.SUPABASE_URL);
  url.search = new URLSearchParams({
    select: 'title,species,sex,age,description,price,mutation',
    status: 'eq.available',
    order: 'created_at.desc',
    limit: String(chatConfig.inventoryLimit)
  }).toString();

  try {
    const response = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const rows = await response.json();
    cachedInventory = rows.filter((bird) => bird && bird.species && bird.title).map((bird) => ({
      title: String(bird.title).slice(0, 100),
      species: String(bird.species).slice(0, 100),
      sex: String(bird.sex || 'não indicado').slice(0, 40),
      age: String(bird.age || 'não indicada').slice(0, 40),
      description: String(bird.description || '').slice(0, 300),
      price: Number(bird.price) || 0,
      mutation: String(bird.mutation || '').slice(0, 100)
    }));
    inventoryCachedAt = Date.now();
    return cachedInventory;
  } catch {
    return null;
  }
}

function getResponseText(payload) {
  return (payload.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text || '')
    .join('\n')
    .trim();
}

async function handleChat(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: 'unsupported_media_type' }, 415, origin);
  }
  if (Number(request.headers.get('Content-Length')) > chatConfig.maxRequestBytes) {
    return jsonResponse({ error: 'request_too_large' }, 413, origin);
  }
  if (limitedByIp(request)) return jsonResponse({ error: 'rate_limited' }, 429, origin);
  if (!env.OPENAI_API_KEY) return jsonResponse({ error: 'chat_not_configured' }, 503, origin);

  const rawBody = await readLimitedBody(request, chatConfig.maxRequestBytes);
  if (!rawBody) return jsonResponse({ error: 'request_too_large' }, 413, origin);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > chatConfig.maxMessages) {
    return jsonResponse({ error: 'invalid_messages' }, 400, origin);
  }
  const messages = body.messages.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
    const content = message.content.trim();
    if (!content || content.length > chatConfig.maxMessageCharacters) return null;
    return { role: message.role, content };
  });
  if (messages.some((message) => !message) || messages.at(-1).role !== 'user') {
    return jsonResponse({ error: 'invalid_messages' }, 400, origin);
  }

  const question = messages.at(-1).content;
  const knowledge = retrieveKnowledge(question, knowledgeBase, chatConfig.retrievedKnowledgeLimit);
  const inventory = await getAvailableBirds(env);
  const instructions = buildInstructions(chatConfig, knowledge, inventory);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: chatConfig.model,
        instructions,
        input: messages,
        reasoning: { effort: 'low' },
        max_output_tokens: chatConfig.maxOutputTokens,
        store: false
      }),
      signal: AbortSignal.timeout(25_000)
    });

    if (!response.ok) {
      let apiError = {};
      try {
        apiError = (await response.json()).error || {};
      } catch {
        // Keep the client response generic if the upstream error is not JSON.
      }
      const diagnostic = {
        status: response.status,
        code: apiError.code,
        type: apiError.type,
        param: apiError.param,
        requestId: response.headers.get('x-request-id')
      };
      console.error('OpenAI Responses API request failed', diagnostic);
      return jsonResponse({
        error: response.status === 429 ? 'model_rate_limited' : 'model_unavailable',
        ...(isLocalOrigin(origin) ? { diagnostic } : {})
      }, 502, origin);
    }
    const result = await response.json();
    const answer = getResponseText(result);
    if (!answer) {
      const output = Array.isArray(result.output) ? result.output : [];
      const diagnostic = {
        responseStatus: result.status,
        outputTypes: output.map((item) => item?.type).filter(Boolean),
        contentTypes: output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
          .map((content) => content?.type)
          .filter(Boolean),
        incompleteReason: result.incomplete_details?.reason
      };
      console.error('OpenAI Responses API returned no extractable text', diagnostic);
      return jsonResponse({
        error: 'empty_model_response',
        ...(isLocalOrigin(origin) ? { diagnostic } : {})
      }, 502, origin);
    }
    return jsonResponse({ answer }, 200, origin);
  } catch (error) {
    const diagnostic = {
      name: error instanceof Error ? error.name : 'UnknownError'
    };
    console.error('OpenAI Responses API request failed before receiving a response', diagnostic);
    return jsonResponse({
      error: 'model_unavailable',
      ...(isLocalOrigin(origin) ? { diagnostic } : {})
    }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/chat') {
      const origin = request.headers.get('Origin');
      if (!origin || (!allowedOrigins(env).has(origin) && !isLocalOrigin(origin))) {
        return jsonResponse({ error: 'origin_not_allowed' }, 403);
      }
      return handleChat(request, env, origin);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};