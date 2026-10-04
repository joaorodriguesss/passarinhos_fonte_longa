import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildInstructions, retrieveKnowledge } from '../chat-core.js';

const config = JSON.parse(await readFile(new URL('../chat-config.json', import.meta.url)));
const knowledge = JSON.parse(await readFile(new URL('../chat-knowledge.json', import.meta.url)));

test('retrieves the Ring Neck pairing guidance for a lutino male question', () => {
  const results = retrieveKnowledge(
    'Tenho um macho de ring neck com 3 anos, é lutino, que fêmea devo comprar?',
    knowledge
  );

  assert.equal(results[0]?.id, 'ring-neck-pairing-baseline');
  assert.match(results[0].content, /pelo menos 2 anos/);
});

test('instructions use the live inventory and prohibit invented stock', () => {
  const prompt = buildInstructions(config, knowledge.slice(0, 1), [
    { species: 'Ring Neck', title: 'Fêmea Albina', sex: 'Fêmea', age: '3 anos', mutation: 'Albina', price: 250 }
  ]);

  assert.match(prompt, /Fêmea Albina/);
  assert.match(prompt, /Não inventes disponibilidade/);
  assert.match(prompt, /resultados genéticos/);
  assert.match(prompt, /fêmea da mesma espécie, estar disponível e ter pelo menos 2 anos/);
});

test('instructions explicitly state when live inventory could not be fetched', () => {
  const prompt = buildInstructions(config, [], null);

  assert.match(prompt, /consulta ao catálogo falhou/);
  assert.match(prompt, /Não afirmes que uma ave está disponível/);
});