---
id: '0007'
title: Publicação — imagem nginx, configuração em runtime e deploy em dev
status: implemented
depends_on: ['0001', '0003']
---

# 0007 — Publicação: Imagem nginx, Configuração em Runtime e Deploy em `dev`

## Goal

Publicar o frontend em `http://finances.dev.homelab.local/`, na mesma origem do backend em `/api`: uma imagem estática em nginx unprivileged construída pelo workflow reutilizável do `homelab-gitops`, a configuração do Firebase entregue em runtime por ConfigMap, os manifests de `dev` reconciliados pelo Argo CD, e a raiz do host passada do backend para o frontend, como prevê o [ADR-0008](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0008-api-path-prefix.md).

## Scope / Non-goals

- **Em escopo:** `Dockerfile` e configuração do nginx; o `config.js` de runtime; `.github/workflows/deploy.yml`; o repositório no WIF do GCP e os secrets do CI; os manifests `finances-frontend` em `dev`; a retirada do ingress `/` do `finances-backend`; a verificação por dentro do cluster.
- **Fora de escopo:** `prd` e promoção (Fase 4); TLS no ingress (plano B do spike, spec 0006); Content-Security-Policy, que entra depois do spike, quando as origens do Firebase estiverem conhecidas na prática; qualquer mudança no backend.
- **Depende de:** [onboarding de app](https://github.com/bhenriq-souza/homelab-gitops/blob/main/docs/app-onboarding.md) e o workflow `docker-build-push.yaml` do `homelab-gitops`; ingress `/api` com `stripPrefix` já ativo ([spec 0005 do backend](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0005-http-platform.md), T-0005-04).

## Contracts

### Imagem

`Dockerfile` multi-stage:

1. **build:** `node:22-alpine`; `npm ci`; `npm run build` (o `prebuild` baixa o contrato fixado e gera os tipos — spec 0005; o build precisa de rede, como no CI).
2. **runtime:** `nginxinc/nginx-unprivileged:<versão fixada>-alpine`, usuário não-root (UID 101), porta **8080**; copia `dist/` para `/usr/share/nginx/html` e `nginx/default.conf` para `/etc/nginx/conf.d/default.conf`.

- A imagem não contém `config.js`: ele vem do ConfigMap. `.dockerignore` exclui `public/config.js`, `node_modules`, `dist`, `coverage`, `e2e`, `specs`, `docs` e `.git`.
- A mesma imagem serve qualquer ambiente; nada de `ARG` ou `ENV` de ambiente no build.

### nginx — `nginx/default.conf`

| Caminho         | Comportamento                                                                               |
| --------------- | ------------------------------------------------------------------------------------------- |
| `/assets/`      | arquivos com hash: `Cache-Control: public, max-age=31536000, immutable`; 404 se não existir |
| `= /config.js`  | `Cache-Control: no-store`; 404 se o ConfigMap não estiver montado                           |
| `= /index.html` | `Cache-Control: no-cache`                                                                   |
| `= /healthz`    | `200` com corpo `ok`, sem log de acesso — alvo das probes                                   |
| `/`             | `try_files $uri /index.html` (fallback da SPA), com o mesmo `no-cache` do `index.html`      |

- Cabeçalhos em toda resposta: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
- `gzip on` para `text/css`, `application/javascript`, `application/json`, `image/svg+xml`.
- `/api` nunca chega a este nginx: o ingress o encaminha ao backend. Este nginx não faz proxy.
- Com `readOnlyRootFilesystem`, os diretórios temporários do nginx (`/tmp`) vêm de um `emptyDir`.

### Configuração de runtime

ConfigMap `finances-frontend-config`, chave `config.js`, com o objeto da spec 0003 para `dev`:

```js
window.__FTECH_CONFIG__ = {
    environment: 'dev',
    firebase: {
        apiKey: '<apiKey do app Web finances-frontend>',
        authDomain: 'dev-financial-control.firebaseapp.com',
        projectId: 'dev-financial-control',
        appId: '1:805955182517:web:652d21a187283fa505c3fc',
    },
};
```

Montado com `subPath` em `/usr/share/nginx/html/config.js`. A web config do Firebase não é segredo (é entregue a todo navegador), por isso fica no ConfigMap versionado, e não no Secret Manager. Mudar a configuração é PR no `homelab-gitops` mais `kubectl rollout restart` (o `subPath` não recarrega sozinho).

### Pipeline — `.github/workflows/deploy.yml`

Igual ao do backend: em `push` para `develop` (ignorando `**.md`, `docs/**`, `specs/**`, `.claude/**`) e por `workflow_dispatch` com `environment` `dev`/`prd`, chama `bhenriq-souza/homelab-gitops/.github/workflows/docker-build-push.yaml@main` com `app-name: finances-frontend` e os secrets `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT` e `GITOPS_DEPLOY_KEY`. O workflow publica `us-central1-docker.pkg.dev/homelab-492918/homelab-apps/finances-frontend:sha-<7>` e `:latest` e reescreve a linha `image:` do `deployment.yaml` no `homelab-gitops`.

### Pré-requisitos fora deste repositório (onboarding, passos 1–3)

1. **WIF:** `bhenriq-souza/finances-control-frontend` em `github_allowed_repositories` do `homelab-infra` (`terraform/clusters/homelab/bootstrap/terraform.tfvars`), aplicado com `-target` por causa do drift registrado no onboarding.
2. **Deploy key** de escrita no `homelab-gitops`, uma por app, com a privada no secret `GITOPS_DEPLOY_KEY` deste repositório.
3. **Secrets** `GCP_WIF_PROVIDER` e `GCP_SERVICE_ACCOUNT`, com os valores do onboarding.

### Manifests — `clusters/homelab/workloads/dev/manifests/finances-frontend/`

| Arquivo              | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deployment.yaml`    | 1 réplica; `imagePullSecrets: [ar-image-pull-secret]`; porta `http` 8080; probes `httpGet /healthz`; requests 10m/32Mi, limits 100m/64Mi; `runAsNonRoot`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: [ALL]`; volumes do ConfigMap (`subPath` `config.js`) e `emptyDir` em `/tmp`; anotação com o hash do `config.js` para reiniciar quando ele mudar |
| `configmap.yaml`     | `finances-frontend-config`, acima                                                                                                                                                                                                                                                                                                                                                                |
| `service.yaml`       | `ClusterIP`, porta 80 → `http`                                                                                                                                                                                                                                                                                                                                                                   |
| `ingress.yaml`       | `ingressClassName: traefik`, host `finances.dev.homelab.local`, `path: /`, `Prefix` → `finances-frontend:80`                                                                                                                                                                                                                                                                                     |
| `kustomization.yaml` | os quatro acima                                                                                                                                                                                                                                                                                                                                                                                  |

O diretório entra em `clusters/homelab/workloads/dev/kustomization.yaml`. Sem label de acesso ao PostgreSQL: o frontend não fala com banco.

### Troca da raiz do host

No mesmo PR do `homelab-gitops` que cria o `finances-frontend`: apagar `finances-backend/ingress.yaml` (a regra `/` do backend) e tirá-lo do `kustomization.yaml` dele. Fica só o `finances-backend-api` (`/api` com `stripPrefix`). O Traefik escolhe o prefixo mais longo, então `/api/**` vai ao backend e todo o resto ao frontend. As probes do backend batem no pod, não no ingress, e não mudam.

### Ordem de publicação

1. T-0007-01: imagem e nginx neste repositório (sem deploy).
2. T-0007-02: WIF, deploy key e secrets (pré-requisitos acima).
3. T-0007-03: `deploy.yml`; o primeiro push em `develop` publica a imagem, e o passo de GitOps do workflow falha por não haver manifest — esperado, registrado no PR.
4. T-0007-04: manifests com a tag `sha-*` publicada no passo 3, a troca da raiz, e a verificação.

## Invariants

- **INV-0007-01:** a imagem é a mesma para qualquer ambiente; o ambiente só existe no `config.js` montado.
- **INV-0007-02:** o container roda sem root, sem escalada de privilégio e com o sistema de arquivos raiz só de leitura.
- **INV-0007-03:** `index.html` e `config.js` nunca são servidos com cache; assets com hash são imutáveis.
- **INV-0007-04:** depois da T-0007-04, `/` do host de `dev` é do frontend e `/api` do backend; nenhuma outra regra de ingress existe para o host.

## Error cases

| Código      | Situação                                     | Comportamento exigido                                                                  |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| ERR-0007-01 | ConfigMap ausente ou chave errada            | `/config.js` responde 404 e a SPA mostra a tela de ERR-0003-01                         |
| ERR-0007-02 | Rota da SPA acessada direto (`/entrar`)      | `200` com o `index.html`, nunca 404                                                    |
| ERR-0007-03 | Asset com hash inexistente                   | `404`, nunca o `index.html` (evita servir HTML como JS depois de um deploy)            |
| ERR-0007-04 | `ImagePullBackOff` com `lookup …: Try again` | é a armadilha de DNS do nó (onboarding, §7): `/etc/resolv.conf` do nó; não é desta app |
| ERR-0007-05 | Passo de GitOps do workflow sem manifest     | falha esperada só no primeiro deploy (ordem de publicação, passo 3)                    |

## Acceptance criteria

- **AC-0007-01:** `docker build` local gera a imagem; `docker run -p 8080:8080` com um `config.js` montado serve a SPA, e `/healthz`, `/config.js`, `/index.html`, `/entrar` e um asset respondem com os status e `Cache-Control` da tabela.
- **AC-0007-02:** o container sobe com `--read-only --tmpfs /tmp --user 101` e `--cap-drop ALL`.
- **AC-0007-03:** um push em `develop` que toca `src/` publica `finances-frontend:sha-<7>` no Artifact Registry, e um que só toca `specs/` não dispara o workflow.
- **AC-0007-04:** depois do merge dos manifests, o Argo CD deixa o deployment `finances-frontend` `Available` em `dev-apps`, na tag publicada.
- **AC-0007-05:** de dentro do cluster (módulo `http` do Node, com o cabeçalho `Host: finances.dev.homelab.local` para o Traefik): `/` devolve o `index.html` do frontend, `/config.js` o objeto de `dev`, `/entrar` o `index.html`, `/api/health` o `200` do backend e `/api/docs` o redirect do Swagger.
- **AC-0007-06:** o ingress `finances-backend` (`/`) não existe mais; `kubectl get ingress -n dev-apps` lista para o host só `finances-backend-api` e `finances-frontend`.

## Test mapping

| Item                                             | Teste                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| AC-0007-01, AC-0007-02, INV-0007-02, INV-0007-03 | execução local colada no PR da T-0007-01                           |
| AC-0007-03, INV-0007-01                          | runs do workflow e do Artifact Registry colados no PR da T-0007-03 |
| AC-0007-04, AC-0007-05, AC-0007-06, INV-0007-04  | evidência do cluster colada no PR da T-0007-04                     |

## Open questions

Nenhuma.
