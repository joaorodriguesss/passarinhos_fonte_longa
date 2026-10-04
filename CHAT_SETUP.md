# Chat do criatorio

## Como funciona

- O navegador envia as mensagens para `/api/chat` no mesmo Worker que serve o site.
- A chave OpenAI e lida apenas pelo Worker atraves do secret `OPENAI_API_KEY`.
- O modelo configurado e `gpt-5-nano`, atualmente o menor preco consultado para texto geral. A API OpenAI e paga por utilizacao; creditos gratuitos nao sao garantidos.
- O Worker consulta as aves com `status = available` no Supabase em cada periodo de cache de 30 segundos. Se a consulta falhar, o assistente nao afirma que alguma ave esta disponivel.
- A recuperacao de conhecimento inicial e lexical e usa `chat-knowledge.json`. Nao usa embeddings nem um servico vetorial nesta primeira versao.
- `chat-config.json` controla os temas, limites e resposta quando falta informacao.
- `scripts/build.mjs` publica apenas os ficheiros do site incluidos na allowlist para `dist/`. O Worker, a configuracao e a base de conhecimento nao sao servidos como assets.

## Configurar a chave OpenAI

No Cloudflare, abre **Workers & Pages > passarinhos-fonte-longa > Settings > Variables and Secrets > Add > Secret**. Usa o nome `OPENAI_API_KEY`, cola o valor diretamente no painel e implementa a alteracao. Nao coloques a chave em `supabase-config.js`, no HTML, no JavaScript do browser, em `chat-config.json` ou no GitHub.

Para desenvolvimento local, cria `.dev.vars` na raiz com:

```dotenv
OPENAI_API_KEY="a-tua-chave-local"
```

O `.gitignore` exclui esse ficheiro. Inicia o Worker com `npx wrangler dev`; o servidor Python simples nao executa `/api/chat`.

## Atualizar o conhecimento

Acrescenta objetos a `chat-knowledge.json`, com `id`, `title`, `source` e `content`. Escreve factos verificaveis e identifica a fonte. A recuperacao lexical seleciona os textos com mais termos em comum com a pergunta; para ampliar o conhecimento, acrescenta termos correntes e nomes alternativos relevantes ao texto.

As regras de pareamento Ring Neck existentes sao a orientacao inicial fornecida pelo responsavel e devem ser confirmadas por ele. O assistente nao promete resultados geneticos. As alternativas de venda precisam de estar no catalogo como disponiveis, ser femeas da mesma especie e ter idade indicada de pelo menos 2 anos.

## Publicacao e protecao de custos

O comando configurado no Cloudflare (`npx wrangler deploy`) executa o build, que limpa e recria `dist/` antes de publicar. O Worker limita o pedido, o historico e a resposta do modelo. O limite por IP em memoria e apenas uma protecao basica por instancia; antes de divulgar o chat, configura tambem uma regra de rate limiting no Cloudflare e um limite de utilizacao/orcamento na plataforma OpenAI.