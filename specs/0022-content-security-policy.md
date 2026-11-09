---
id: '0022'
title: Content-Security-Policy no nginx do frontend
status: draft
depends_on: ['0004', '0006', '0007']
---

# 0022 — Content-Security-Policy no nginx do frontend

## Goal

Servir o frontend com uma `Content-Security-Policy` restritiva, definida em um único lugar do nginx, sem `unsafe-inline` nem `unsafe-eval` em `script-src`. O script inline do tema (spec 0004) entra na política por hash, calculado no build da imagem a partir do `index.html` real, de modo que mudar o script nunca deixe a política desatualizada. A política entra primeiro em modo `Report-Only`, é validada contra o login Google real em `dev` e só então passa a ser imposta.

## Scope / Non-goals

- **Em escopo:** o gerador `scripts/csp.mjs` e o modelo da política; o arquivo `csp.conf` gerado no build da imagem e incluído por `nginx/security-headers.conf`; a verificação do hash no gate `build`; o teste e2e de ausência de violações; a validação em `dev` e a passagem de `Report-Only` para imposição.
- **Fora de escopo:** endpoint de coleta de relatórios (`report-uri`/`report-to`): as violações são lidas no console do navegador; `Strict-Transport-Security` e TLS (plano B do spike, spec 0006); CSP no `vite dev`; qualquer mudança no backend, nos manifests do `homelab-gitops` ou no `config.js`.
- **Altera a [spec 0007](0007-publication.md):** a CSP deixa de estar fora do escopo dela (o spike T-0006-01 está concluído). A 0007 só aponta para esta spec; o nginx continua sendo definido por ela.
- **Numeração:** a faixa `0000`–`0009` está esgotada e `0010`+ espelha as specs de domínio do backend. Esta spec toma o próximo número livre, `0022`, por ser de plataforma. Alternativa descartada: reabrir a 0007 e acrescentar a CSP nela, que misturaria uma spec `implemented` de infraestrutura com uma política que tem rollout próprio.

## Contracts

### Política

Uma diretiva por linha lógica, separadas por `; `. `<hashes>` é a lista de `'sha256-…'` dos scripts inline do `index.html` (abaixo).

| Diretiva          | Valor                                                                              | Motivo                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `default-src`     | `'self'`                                                                           | base fechada                                                                                                            |
| `script-src`      | `'self' <hashes> https://apis.google.com`                                          | bundle e `/config.js` da mesma origem; script de tema por hash; `apis.google.com` carrega o login por popup do Firebase |
| `style-src`       | `'self'`                                                                           | o CSS é um arquivo em `/assets/`; o React aplica `style` pelo CSSOM, que a CSP não bloqueia                             |
| `img-src`         | `'self' data: blob: https://*.googleusercontent.com`                               | favicon e ícones; foto do usuário (recorte em `blob:`/`data:`, spec 0006); foto da conta Google                         |
| `font-src`        | `'self' data:`                                                                     | fontes do `@fontsource` empacotadas pelo Vite (as pequenas viram `data:`)                                               |
| `connect-src`     | `'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com` | `/api` na mesma origem; login e renovação de token do Firebase Auth                                                     |
| `frame-src`       | `https://*.firebaseapp.com https://accounts.google.com`                            | iframe/popup do `authDomain` (`/__/auth/…`) e tela de consentimento do Google                                           |
| `object-src`      | `'none'`                                                                           |                                                                                                                         |
| `base-uri`        | `'self'`                                                                           |                                                                                                                         |
| `form-action`     | `'self'`                                                                           |                                                                                                                         |
| `frame-ancestors` | `'none'`                                                                           | equivale ao `X-Frame-Options: DENY`, que continua enviado                                                               |

- A imagem é a mesma para todo ambiente (INV-0007-01): o `authDomain` do `config.js` não entra na política, por isso `*.firebaseapp.com`.
- As origens do Firebase e do Google são a hipótese de partida; a lista final é a que o login real em `dev` exigir (T-0022-03), nunca mais larga que o necessário. Origem acrescentada ou removida lá altera esta tabela no mesmo PR.
- Se a validação mostrar violação de `style-src` por estilo inline de atributo, a correção permitida é `style-src-attr 'unsafe-inline'` (não afeta execução de script), registrada aqui; `unsafe-inline` em `script-src` e em `style-src-elem` nunca.
- O `config.js` é servido da mesma origem (`<script src="/config.js">`), coberto por `'self'`.

### Hash do script inline

`scripts/csp.mjs`:

- exporta `buildCsp(html: string, mode?): { header: string; value: string }` (puro, testável) e, como CLI, `node scripts/csp.mjs <dist> <saída.conf>`;
- extrai do `index.html` de `dist/` cada `<script>` **sem** atributo `src`, calcula `sha256` do conteúdo exato (bytes entre as tags, base64) e monta `'sha256-<base64>'`;
- falha (código 1, nomeando o problema) se achar `<script>` com `type` diferente de `module`/ausente que seja inline e não seja o de tema, atributo de evento (`onclick=` etc.), `<style>` inline ou `javascript:` em `href`: nada disso é coberto pela política;
- falha se `dist/index.html` não tiver nenhum script inline (o tema da spec 0004 é obrigatório);
- escreve o arquivo `csp.conf` com uma só linha: `add_header <Cabeçalho> "<política>" always;`.

O cabeçalho é `Content-Security-Policy-Report-Only` enquanto a constante `CSP_ENFORCE` de `scripts/csp.mjs` for `false` e `Content-Security-Policy` quando for `true`. Em `Report-Only`, `frame-ancestors` é ignorado pelo navegador (o `X-Frame-Options` cobre).

### nginx e imagem

- O `Dockerfile`, no estágio de build, depois de `npm run build`: `RUN node scripts/csp.mjs dist /app/csp.conf`. No runtime: `COPY --from=build /app/csp.conf /etc/nginx/snippets/csp.conf`.
- `nginx/security-headers.conf` ganha `include /etc/nginx/snippets/csp.conf;`. Como o arquivo já é incluído em todo `location`, a CSP sai em toda resposta, inclusive `/healthz` e 404 (`always`).
- O `csp.conf` fica fora de `dist/`: não é servido.
- Nada de `ARG`/`ENV` de ambiente: o hash depende só do `index.html` construído.

### Gate `build`

`scripts/build.mjs` (spec 0002) passa a rodar, sobre o `dist/` do build de produção, a mesma verificação do `buildCsp`: reprova se o `index.html` tiver inline não coberto (lista acima). Isso faz um `<script>` ou `<style>` novo quebrar o `npm run check` e não só a produção. A tabela de limiares da spec 0002 não muda; a mudança do gate é registrada nesta spec e na 0002 (seção do gate `build`) no PR da T-0022-01.

### e2e

Em `vite preview` (modo `e2e`) não há nginx. Um plugin do Vite aplicado só ao preview do modo `e2e` responde cada requisição com `Content-Security-Policy` **imposta** (nunca `Report-Only`), gerada por `buildCsp` sobre o `dist/index.html` do próprio build. `e2e/csp.spec.ts` navega pelas rotas principais registrando eventos `securitypolicyviolation`.

## Invariants

- **INV-0022-01:** `script-src` nunca contém `'unsafe-inline'`, `'unsafe-eval'` nem curinga de esquema (`https:`); script inline só entra por hash.
- **INV-0022-02:** todo `<script>` inline do `index.html` publicado tem o seu hash na política; o hash é calculado do `dist/index.html` do mesmo build, nunca escrito à mão.
- **INV-0022-03:** a imagem continua a mesma para qualquer ambiente (INV-0007-01): a política não depende de `config.js` nem de variável de ambiente.
- **INV-0022-04:** toda resposta do nginx (assets, `config.js`, `index.html`, fallback da SPA, `/healthz`, 404) leva o cabeçalho da CSP.
- **INV-0022-05:** a aplicação não gera violação da política em nenhuma rota exercitada pelo e2e nos três tamanhos de tela.

## Error cases

| Código      | Situação                                                                                         | Comportamento exigido                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| ERR-0022-01 | `index.html` sem script inline                                                                   | `csp.mjs` sai com 1 dizendo que o script de tema sumiu; o build da imagem e o gate `build` falham                 |
| ERR-0022-02 | Inline não coberto (`<style>`, `onclick=`, script inline extra sem hash previsto, `javascript:`) | `csp.mjs` e o gate `build` saem com 1 citando o trecho; nunca se relaxa a política para passar                    |
| ERR-0022-03 | Violação em `Report-Only` durante a validação em `dev`                                           | a origem ou o código é corrigido por PR (tabela desta spec ou o código); não se passa a impor com violação aberta |
| ERR-0022-04 | Login Google bloqueado depois de impor a política                                                | reverter `CSP_ENFORCE` para `false` em PR de correção imediata, ampliar a tabela só com a origem comprovada       |

## Acceptance criteria

- **AC-0022-01:** `buildCsp` aplicado a um `index.html` de fixture com o script de tema devolve uma política cujo `script-src` é `'self' 'sha256-<hash do conteúdo>' https://apis.google.com`, com o hash igual ao calculado de forma independente no teste; alterar um caractere do script muda o hash.
- **AC-0022-02:** `buildCsp` falha nos casos de ERR-0022-01 e ERR-0022-02 (sem inline; `<style>` inline; atributo `onclick`; segundo script inline não esperado).
- **AC-0022-03:** `docker build` local gera a imagem e `curl -sI` em `/`, `/entrar`, `/assets/<arquivo>`, `/config.js`, `/healthz` e numa rota inexistente sob `/assets/` mostra o cabeçalho da CSP (`Content-Security-Policy-Report-Only` na T-0022-01) com o hash do `index.html` servido; o hash do `index.html` do container, recalculado por fora, bate com o do cabeçalho.
- **AC-0022-04:** o gate `build` é FAIL com um `<style>` inline posto no `index.html` e PASS no código atual.
- **AC-0022-05:** `e2e/csp.spec.ts` navega pelas rotas de entrada, dashboard, listas e um formulário com diálogo, com a CSP imposta no preview, e não registra nenhum evento `securitypolicyviolation` nem erro de console de CSP, nos projetos `celular`, `tablet` e `desktop`.
- **AC-0022-06:** em `dev` (`finances.dev.homelab.local` e `finances.192.168.15.97.nip.io`), com a política em `Report-Only`, o login Google completo (popup, retorno, sessão ativa e saída), a troca de tema e o envio da foto do usuário não geram violação no console; a evidência é colada no PR e a tabela de Contracts reflete as origens realmente necessárias.
- **AC-0022-07:** com `CSP_ENFORCE = true`, a imagem publicada em `dev` envia `Content-Security-Policy` (e não o `Report-Only`) e o login Google continua funcionando; `curl -sI` colado no PR.

## Test mapping

| Item                                             | Teste                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| AC-0022-01, AC-0022-02, INV-0022-01, INV-0022-02 | `scripts/csp.test.mjs` (função pura `buildCsp`, com fixtures de `index.html`)      |
| AC-0022-03, INV-0022-03, INV-0022-04             | execução local da imagem colada no PR da T-0022-01 (`curl -sI` por caminho)        |
| AC-0022-04                                       | `scripts/build.test.mjs` e prova manual no PR da T-0022-01                         |
| AC-0022-05, INV-0022-05                          | `e2e/csp.spec.ts`                                                                  |
| AC-0022-06, AC-0022-07                           | evidência de `dev` (console do navegador e `curl -sI`) colada nos PRs da T-0022-03 |

## Open questions

Nenhuma.

## Decisões

- **Hash no build da imagem, por script próprio.** Alternativas descartadas: calcular no nginx em tempo de execução (`sub_filter`/`envsubst` no entrypoint) complica o container com `readOnlyRootFilesystem`; manter o hash à mão em `security-headers.conf` fica velho a cada edição do script; um plugin do Vite acopla a política ao bundler e não serve ao `Dockerfile`. O script no `Dockerfile` e no gate `build` usa a mesma função, então o mesmo código decide em CI e na imagem.
- **Rollout em `Report-Only` antes de impor.** O login Google só se prova de verdade em `dev`, e o e2e usa autenticação falsa: `Report-Only` revela origens esquecidas sem derrubar o login. Sem endpoint de relatórios, por ser um único ambiente de `dev` com a pessoa que valida no navegador; custo e superfície de um coletor não se justificam agora.
- **Passagem a `enforce` por constante em código (`CSP_ENFORCE`)**, não por variável de ambiente, para preservar INV-0022-03.
- **Sem `style-src 'unsafe-inline'`.** O CSS é arquivo, o React usa CSSOM; a exceção `style-src-attr` só entra se a validação provar necessidade.
