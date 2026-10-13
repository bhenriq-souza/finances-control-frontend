---
id: '0006'
title: Autenticação, estados da conta e app shell
status: approved
depends_on: ['0003', '0004', '0005']
---

# 0006 — Autenticação, Estados da Conta e App Shell

## Goal

Levar o usuário do primeiro acesso até o app: entrar por email e senha ou pelo Google no Firebase `dev-financial-control`, criar conta com verificação de email, redefinir a senha, e ser encaminhado conforme o estado da conta que o backend devolve (sem perfil, email por verificar, ativo) — tudo dentro de um app shell responsivo, com a escolha de tema. Antes disso, validar no spike que o login Google funciona numa origem HTTP fora de `localhost`, risco registrado no [ADR-0006](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0006-auth.md).

## Scope / Non-goals

- **Em escopo:** o spike (T-0006-01); a porta `AuthClient` completa; as rotas públicas (entrar, criar conta, redefinir senha) e as de estado da conta (verificar email, aguardando aprovação); a guarda das rotas autenticadas por `GET /users/me`; o registro do token no cliente da API (spec 0005); o app shell (cabeçalho, navegação, menu do usuário, seletor de tema) nos três tamanhos; uma tela inicial provisória; a remoção da página do spike da spec 0003.
- **Fora de escopo:** administração de usuários e concessão de perfil (tela da spec 0010 do frontend); o dashboard de saldo (spec 0015 do frontend); itens de navegação de F002–F005, que cada spec de tela acrescenta ao shell; PWA (fora da Fase 3).
- **Depende do backend:** [spec 0010](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0010-identity.md) na tag `v1.1.0` — `GET /users/me` responde `200` também sem perfil (`profile: null`); `403 PROFILE_PENDING` nas demais rotas; `403 EMAIL_NOT_VERIFIED` ao re-vincular email não verificado; papéis `ADMIN`, `BILLER`, `VIEWER` ([perfis](https://github.com/bhenriq-souza/finances-control/blob/main/docs/user-profiles.md)).

## Contracts

### Spike do login Google em HTTP

Primeira tarefa depois das specs de fundação. Usa a página da spec 0003, publicada pela spec 0007, em `http://finances.dev.homelab.local/`.

- **Hipótese:** `signInWithPopup` do Firebase conclui o login Google numa origem `http://` fora de `localhost`, com `finances.dev.homelab.local` nos domínios autorizados do projeto `dev-financial-control` e o `authDomain` `dev-financial-control.firebaseapp.com`.
- **Roteiro:** num desktop (Chrome) e num celular (Chrome Android ou Safari iOS) com o DNS de `homelab.local` configurado: entrar com Google; entrar com email e senha; recarregar e conferir que a sessão persiste; chamar `GET /api/users/me` e conferir o `200`.
- **Sucesso:** o login Google conclui nos dois aparelhos e `GET /api/users/me` responde `200` com o token obtido, com o `email` da conta Google.
- **Riscos a observar:** APIs do navegador restritas a contexto seguro (`crypto.subtle`, alguns usos de `indexedDB`), bloqueio de popup no celular e particionamento de armazenamento de terceiros.
- **Plano B, se falhar:** TLS no ingress de `dev` — certificado de uma CA local (cert-manager com `ClusterIssuer` de CA própria, instalada nos aparelhos) em `https://finances.dev.homelab.local`, com o domínio já autorizado no Firebase. O plano B vira tarefa no `homelab-gitops` e uma revisão desta spec, decididas pelo responsável.
- **Registro:** o resultado (aparelhos, navegadores, prints, saída de `/api/users/me` sem o token) vai no PR da T-0006-01, que só toca o backlog e esta spec: se o spike passar, nada muda nos contratos abaixo; se falhar, a spec é revisada antes das tarefas seguintes.

### Porta `AuthClient` (amplia a da spec 0003)

```ts
interface AuthClient {
    // da spec 0003
    onAuthStateChanged(listener: (user: AuthUser | null) => void): () => void;
    signInWithEmail(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    getIdToken(forceRefresh?: boolean): Promise<string | null>;
    // novos
    signUpWithEmail(name: string, email: string, password: string): Promise<void>;
    sendEmailVerification(): Promise<void>;
    sendPasswordReset(email: string): Promise<void>;
    reloadUser(): Promise<AuthUser | null>;
}
```

- **Persistência:** `browserLocalPersistence` (a sessão sobrevive a fechar o navegador).
- **Idioma:** `auth.languageCode = 'pt'`, para os emails do Firebase saírem em português.
- **Google:** `signInWithPopup`. Popup fechado pelo usuário não é erro visível.
- **Cadastro:** `createUserWithEmailAndPassword`, `updateProfile({ displayName: name })` e `sendEmailVerification`, nessa ordem; o envio do email de verificação no cadastro é exigência do [ADR-0009](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0009-firebase-project.md). Depois que `createUserWithEmailAndPassword` dá certo, a conta já existe e a sessão já está aberta: uma falha em `updateProfile` ou em `sendEmailVerification` não volta ao formulário (uma nova tentativa daria `auth/email-already-in-use`) e o cadastro segue para a guarda de `_app`, onde o email pode ser reenviado. Só uma falha da criação aparece no formulário (decisão do responsável, 2026-10-13).
- **Erros do Firebase** viram mensagens pt-BR por `code` do Firebase em `src/features/identity/auth-errors.ts` (ex.: `auth/invalid-credential` → "Email ou senha incorretos."; `auth/email-already-in-use` → "Já existe uma conta com este email. Entre ou redefina a senha."; `auth/too-many-requests`; `auth/network-request-failed`; `auth/popup-blocked`; `auth/weak-password`). Código sem entrada cai numa mensagem genérica; o texto do Firebase nunca aparece.

### Rotas

| Rota                    | Acesso                 | Conteúdo                                                                                                                                                                                                                           |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/entrar`               | só sem sessão          | email e senha, **Entrar com Google**, links para criar conta e redefinir senha; logo horizontal da FarmTech                                                                                                                        |
| `/criar-conta`          | só sem sessão          | nome, email, senha (mínimo 8 caracteres) e confirmação                                                                                                                                                                             |
| `/redefinir-senha`      | só sem sessão          | email; confirma o envio sem revelar se a conta existe                                                                                                                                                                              |
| `/verificar-email`      | com sessão             | o email da conta, **Reenviar email** (limite de um envio por minuto), **Já verifiquei**, **Sair**                                                                                                                                  |
| `/aguardando-aprovacao` | com sessão, sem perfil | explica que um Admin precisa liberar o acesso; com `emailVerified: false` em `/users/me`, avisa que o email ainda não foi verificado e oferece **Reenviar email** (limite de um envio por minuto); **Verificar de novo**, **Sair** |
| `/`                     | com sessão e perfil    | tela inicial provisória dentro do shell: "Olá, <nome>" e o perfil, até o dashboard (spec 0015)                                                                                                                                     |

- Com sessão, `/entrar`, `/criar-conta` e `/redefinir-senha` redirecionam para `/`.
- `/entrar?redirect=<rota>` volta à rota de origem depois do login; só aceita caminhos internos (começam com `/` e não com `//`).
- **Já verifiquei:** `reloadUser`, `getIdToken(true)` e nova consulta a `/users/me`; continua na tela se o email ainda não estiver verificado, com aviso.
- **Verificar de novo:** `reloadUser`, `getIdToken(true)` e nova consulta a `/users/me`. O token novo é o que leva ao backend a verificação feita pelo link do email; sem ele, `emailVerified` só muda na renovação automática do token, em até uma hora.

### Guarda das rotas autenticadas

Um layout de rota `_app` envolve as rotas com sessão e perfil. No `beforeLoad`:

1. espera o primeiro `onAuthStateChanged` (tela de carregamento com o símbolo da marca, sem piscar o login);
2. sem usuário → `/entrar?redirect=<rota atual>`;
3. `queryClient.ensureQueryData` de `GET /users/me` (chave `['users', 'me']`):
    - `200` com `profile: null` → `/aguardando-aprovacao`;
    - `ApiError` `EMAIL_NOT_VERIFIED` → `/verificar-email`;
    - `ApiError` `UNAUTHENTICATED` → sai da sessão e vai a `/entrar`;
    - `200` com perfil → segue, com o usuário no contexto da rota.

O resultado de `/users/me` fica no cache do TanStack Query; `useCurrentUser()` (exportado por `identity`) é o acesso dos componentes. Sair da sessão limpa todo o cache (`queryClient.clear()`).

O `app` registra `setTokenProvider` (spec 0005) com `authClient.getIdToken` antes de montar o roteador.

### App shell

Segue o componente `AppShell` do [Design System](https://claude.ai/artifact/DxDnUbE9sSQdJbxTPh6WPQ) e os artboards do [dashboard](https://claude.ai/artifact/HEj1d1jqqwAPMBVYZdMsyy):

| Tamanho             | Navegação                                     | Cabeçalho                                                                         |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| celular (< 768px)   | barra inferior fixa, ícone e rótulo           | símbolo compacto + "FTech Finance", menu do usuário                               |
| tablet (768–1023px) | barra inferior fixa, ícone e rótulo           | idem, com mais respiro (`espaco-5`)                                               |
| desktop (≥ 1024px)  | barra lateral fixa à esquerda, ícone e rótulo | símbolo + "FTech Finance" no topo da lateral; menu do usuário no topo do conteúdo |

- **Itens de navegação** declarados numa lista em `src/app/shell/navigation.ts` (`{ to, label, icon, profiles }`), filtrada pelo perfil do usuário. Nesta spec só existe **Início** (`/`); cada spec de tela acrescenta os seus.
- **Menu do usuário:** nome, email, perfil em pt-BR (Administrador, Lançador, Leitor), seletor de tema (Sistema, Escuro, Claro — `useTheme` da spec 0004) e **Sair**.
- **Marca:** os SVGs da FarmTech de `docs/design/assets/` do hub, copiados para `src/ui/brand/` no mesmo commit do hub fixado para os tokens, com o commit de origem anotado no `README.md` da pasta.
- **Ícone da aba:** o `favicon.svg` do hub, do mesmo commit, vai para `public/`, com um `favicon-32.png` (32×32) e um `apple-touch-icon.png` (180×180) gerados dele e versionados; o `index.html` declara os três (`<link rel="icon" type="image/svg+xml">`, `<link rel="icon" type="image/png" sizes="32x32">` e `<link rel="apple-touch-icon">`) (decisão do responsável em 2026-10-13).
- **Camadas:** o cabeçalho, com o menu do usuário aberto, e a barra de navegação ficam acima do botão flutuante das listas (**Nova despesa**, **Nova receita**); diálogos e folhas ficam acima de tudo.
- **Acessibilidade:** navegação em `<nav aria-label="Principal">`, item ativo com `aria-current="page"`, alvos de toque de pelo menos 44×44px, foco visível com `foco`.

### Fake de autenticação no e2e

`fake-auth-client.ts` (spec 0003) implementa a porta toda, com usuários fixos escolhidos pelo teste antes do carregamento (por `localStorage` na chave `ftech.e2e.usuario`): `ativo` (perfil `ADMIN`), `sem-perfil`, `email-nao-verificado` e nenhum. O `e2e` simula `GET /api/users/me` com `page.route` coerente com o usuário escolhido.

## Invariants

- **INV-0006-01:** nenhuma rota de `_app` renderiza antes de `GET /users/me` responder com perfil.
- **INV-0006-02:** usuário sem perfil só vê `/aguardando-aprovacao`, e com email por verificar (sinalizado pelo backend) só vê `/verificar-email` — além de poder sair.
- **INV-0006-03:** a navegação mostra só itens cujo `profiles` inclui o perfil do usuário.
- **INV-0006-04:** sair da sessão apaga o cache de consultas; nenhum dado do usuário anterior aparece para o seguinte.
- **INV-0006-05:** mensagens de autenticação vêm do catálogo de erros do Firebase (pt-BR), nunca do texto do SDK.
- **INV-0006-06:** o `redirect` do login só leva a caminhos internos.

## Error cases

| Código      | Situação                                          | Comportamento exigido                                                           |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| ERR-0006-01 | Email ou senha incorretos                         | "Email ou senha incorretos." no formulário; campos preservados (exceto a senha) |
| ERR-0006-02 | Popup do Google bloqueado                         | "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo."     |
| ERR-0006-03 | Popup fechado pelo usuário                        | nada visível                                                                    |
| ERR-0006-04 | `GET /users/me` com `NETWORK_ERROR` ou `5xx`      | tela de erro com a mensagem do catálogo e **Tentar de novo**; sessão mantida    |
| ERR-0006-05 | `GET /users/me` com `AUTH_UNAVAILABLE`            | a mesma tela, com a mensagem do catálogo para `AUTH_UNAVAILABLE`                |
| ERR-0006-06 | Reenvio de verificação antes de um minuto         | botão desabilitado com a contagem regressiva                                    |
| ERR-0006-07 | `redirect` externo (`//exemplo.com`, `https://…`) | ignorado; vai para `/`                                                          |

## Acceptance criteria

- **AC-0006-01:** spike executado conforme o roteiro, com o resultado (sucesso ou falha e plano B) registrado no PR da T-0006-01.
- **AC-0006-02:** sem sessão, abrir `/` leva a `/entrar?redirect=%2F`; depois do login com usuário `ativo`, a tela inicial aparece com o nome e o perfil.
- **AC-0006-03:** com o usuário `sem-perfil`, qualquer rota de `_app` leva a `/aguardando-aprovacao`; **Verificar de novo** com `/users/me` já com perfil leva a `/`.
- **AC-0006-04:** com `/users/me` respondendo `403 EMAIL_NOT_VERIFIED`, qualquer rota de `_app` leva a `/verificar-email`; **Reenviar email** chama `sendEmailVerification` e fica desabilitado por um minuto.
- **AC-0006-05:** criar conta chama, em ordem, o cadastro, a atualização do nome e o envio de verificação, e leva à guarda de `_app`.
- **AC-0006-06:** **Sair** no menu do usuário volta a `/entrar` e um novo login com outro usuário não mostra dados do anterior.
- **AC-0006-07:** o shell mostra a barra inferior nos projetos `celular` e `tablet` e a barra lateral no `desktop`, com o item ativo marcado por `aria-current`.
- **AC-0006-08:** o seletor de tema do menu muda o tema na hora e a escolha sobrevive a recarregar.
- **AC-0006-09:** os casos ERR-0006-01, ERR-0006-02, ERR-0006-04 e ERR-0006-07 mostram o comportamento da tabela.
- **AC-0006-10:** a página do spike da spec 0003 e o `fetch` direto dela não existem mais.
- **AC-0006-11:** no cadastro, uma falha de `sendEmailVerification` depois de criada a conta leva à guarda de `_app` mesmo assim, sem erro no formulário; uma falha de `createUserWithEmailAndPassword` fica no formulário.
- **AC-0006-12:** em `/aguardando-aprovacao`, com `emailVerified: false`, aparecem o aviso e **Reenviar email**, que chama `sendEmailVerification` e fica desabilitado por um minuto; com `emailVerified: true`, nenhum dos dois. **Verificar de novo** chama `reloadUser` e `getIdToken(true)` antes da nova consulta a `/users/me`.
- **AC-0006-13:** o `index.html` publicado declara o ícone SVG, o PNG de 32px e o `apple-touch-icon`, e os três arquivos respondem `200`.
- **AC-0006-14:** no celular, com o menu do usuário aberto em `/despesas`, o painel do menu fica acima do botão flutuante **Nova despesa**: um clique no ponto em que os dois se sobrepõem atinge o painel.

## Test mapping

| Item                                                         | Teste                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| AC-0006-01                                                   | evidência manual no PR da T-0006-01                                 |
| AC-0006-02, AC-0006-03, AC-0006-04, INV-0006-01, INV-0006-02 | `e2e/auth-guard.spec.ts` e `src/app/routes/guard.test.ts`           |
| AC-0006-05                                                   | `src/features/identity/sign-up.test.tsx`                            |
| AC-0006-06, INV-0006-04                                      | `e2e/sign-out.spec.ts`                                              |
| AC-0006-07, INV-0006-03                                      | `e2e/shell.spec.ts` e `src/app/shell/navigation.test.ts`            |
| AC-0006-08                                                   | `e2e/theme.spec.ts`                                                 |
| AC-0006-09, INV-0006-05, INV-0006-06                         | `src/features/identity/auth-errors.test.ts` e `e2e/sign-in.spec.ts` |
| AC-0006-10                                                   | revisão do PR da T-0006-02 e o gate `boundaries`                    |
| AC-0006-11, AC-0006-12                                       | `src/features/identity/**/*.test.tsx` e `e2e/auth-guard.spec.ts`    |
| AC-0006-13, AC-0006-14                                       | `e2e/shell.spec.ts`                                                 |

## Open questions

Nenhuma.
