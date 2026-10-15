---
id: '0021'
title: Espaços na aprovação de usuários e no menu
status: approved
depends_on: ['0006', '0009', '0010', '0011', '0012', '0014']
---

# 0021 — Espaços na Aprovação de Usuários e no Menu

## Goal

Levar para a tela os espaços da Fase 5. Cada usuário aprovado passa a ter a sua própria conta no
app, com registros que ninguém de fora vê. A aprovação continua na tela **Usuários**, como hoje,
mas passa a dizer **onde** o usuário entra: num espaço novo, do qual ele vira administrador, ou
num espaço que já existe, com um perfil. O usuário vê o nome do seu espaço no menu. Bancos e
tipos de despesa e de receita viram catálogos comuns a todos: só o admin da plataforma os
escreve, e os demais só escolhem deles. Decisões do responsável em 2026-10-15 (FC-013): espaço com membros, bancos e
tipos globais geridos só pelo admin da plataforma, e aprovação na tela **Usuários** dizendo em qual
espaço.

## Scope / Non-goals

- **Em escopo:**
    - o diálogo de aprovação com **Novo espaço** ou **Espaço existente**;
    - a coluna **Espaço** na lista de usuários;
    - a troca de perfil dentro do espaço e a remoção do membro;
    - renomear um espaço;
    - o nome do espaço no menu do usuário;
    - a tela **Usuários** e as escritas de bancos e de tipos guardadas pela marca de admin da
      plataforma, e não mais pelo perfil `ADMIN`;
    - os códigos de erro novos no catálogo e a saída de `LAST_ADMIN`;
    - o contrato da tag nova do backend em `sources.json`.
- **Fora de escopo:**
    - trocar de espaço na tela, porque o usuário é membro de um espaço só na Fase 5 (backend,
      INV-0021-02);
    - mover um membro de um espaço para outro numa ação só: remove-se e aprova-se de novo;
    - o admin de um espaço gerindo os próprios membros, porque a API só aceita o admin da
      plataforma;
    - criar espaço fora da aprovação e excluir espaço, que a API não oferece;
    - mostrar ou filtrar por espaço nas demais telas: o backend já devolve só o espaço do usuário,
      e nenhuma resposta de domínio traz `workspaceId` (backend, INV-0021-10).
- **Depende do backend:**
    - [spec 0021](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0021-workspaces.md)
      na tag `v1.5.0`, que será criada com o ok do responsável;
    - `GET /users/me` e `GET /users` com `workspace` e `isPlatformAdmin`; `PATCH /users/{id}/profile`
      com as três formas de corpo; `GET /workspaces` e `PATCH /workspaces/{id}`.
- **Forma visual:** padrão de **cadastro** da spec 0009, o diálogo da spec 0010 e o
  [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC). Só tokens existentes.

## Contracts

### Usuário atual

`CurrentUser` (de `GET /users/me`, cache `['users', 'me']`) ganha dois campos lidos da resposta:

| Campo             | Tipo                   | Uso                                       |
| ----------------- | ---------------------- | ----------------------------------------- |
| `workspace`       | `{ id, name } \| null` | nome do espaço no menu                    |
| `isPlatformAdmin` | `boolean`              | tela **Usuários** e escrita dos catálogos |

`profile` continua sendo o perfil no espaço. A regra de aguardando aprovação da spec 0006 passa a
olhar também a marca: o usuário vê a tela de aguardando só quando não tem `profile` **e** não é
admin da plataforma.

### Admin da plataforma sem espaço

O backend aceita um admin da plataforma sem espaço (`workspace: null`, `isPlatformAdmin: true`):
ele continua com as rotas de usuário, de espaço e de catálogo, e recebe `403 PROFILE_PENDING` só
nas rotas de domínio. Na tela:

- a guarda de `_app` **não** o leva a `/aguardando-aprovacao`; ele entra no app com o shell
  normal;
- alcança `/usuarios`, o painel de espaços, `/contas/bancos`, `/despesas/tipos` e
  `/receitas/tipos`, com leitura e escrita;
- toda outra tela de `_app` (Início, despesas, receitas, cartões, contas, transferências, séries,
  fluxo de caixa, relatórios) mostra, no lugar do conteúdo e sem chamar a API, o `EmptyState`
  `sem-espaco`: "Você ainda não está em um espaço. Para ver e lançar registros, entre em um
  espaço pela tela Usuários." com o botão **Ir para Usuários**;
- a navegação mostra só os itens que ele alcança: **Usuários** e os catálogos ficam visíveis, e
  os demais itens somem; `/` leva a `/usuarios`;
- o menu do usuário não mostra a linha do espaço.

Para entrar num espaço, outro admin da plataforma o aprova; ele mesmo não pode, porque o backend
recusa alterar o próprio membro (`CANNOT_CHANGE_OWN_PROFILE`).

### Permissões

A tabela de permissões da spec 0009 muda assim:

| Permissão        | Antes             | Agora                                           |
| ---------------- | ----------------- | ----------------------------------------------- |
| `users.manage`   | `ADMIN`           | `isPlatformAdmin`                               |
| `catalog.write`  | — (nova)          | `isPlatformAdmin`                               |
| `accounts.write` | `ADMIN`           | `ADMIN` (contas bancárias e cartões, no espaço) |
| `entries.write`  | `ADMIN`, `BILLER` | `ADMIN`, `BILLER` (lançamentos, no espaço)      |

- `can()` passa a receber o usuário atual, e não só o perfil, porque duas permissões dependem da
  marca. `useCan(permission)` mantém a assinatura.
- `catalog.write` guarda **Novo banco**, **Editar**, **Arquivar** e **Desarquivar** em
  `/contas/bancos` (hoje `accounts.write`), e **Novo tipo**, **Renomear**, **Arquivar** e
  **Desarquivar** nas telas de tipos de despesa e de receita (hoje `entries.write`). Sem a
  permissão, as telas mostram a lista, só leitura, e os parâmetros `?novo` e `?editar` são
  ignorados.
- Os formulários de despesa, receita, conta e cartão continuam escolhendo bancos e tipos da lista,
  sem mudança.

### Navegação

- `NavItem` ganha `platformAdmin?: true`. Item com a marca só aparece para quem tem
  `isPlatformAdmin`, e o campo `profiles` passa a ser ignorado nele. Sem espaço, o admin da
  plataforma vê só os itens com a marca (ver "Admin da plataforma sem espaço").
- O item **Usuários** fica `{ to: '/usuarios', label: 'Usuários', icon: Users, platformAdmin: true,
slot: 'mais' }`.
- `/usuarios` confere `can(user, 'users.manage')` no `beforeLoad`; sem a permissão, `EmptyState`
  `sem-acesso` (ERR-0009-05).

### Menu do usuário

O menu do usuário (spec 0006) mostra o nome do espaço como texto de apoio, abaixo do nome e do
email: "Espaço: <nome>". Sem espaço, a linha não aparece.

### Consultas e escritas

| Operação                    | Rota do backend              | Corpo                                          | Chave / invalidação                 |
| --------------------------- | ---------------------------- | ---------------------------------------------- | ----------------------------------- |
| listar usuários             | `GET /users`                 | —                                              | `['users', 'list']`                 |
| listar espaços              | `GET /workspaces`            | —                                              | `['workspaces', 'list']`            |
| aprovar em espaço novo      | `PATCH /users/{id}/profile`  | `{ profile: 'ADMIN', newWorkspace: { name } }` | `invalidateAfter(..., 'profile')`   |
| aprovar em espaço existente | `PATCH /users/{id}/profile`  | `{ profile, workspaceId }`                     | `invalidateAfter(..., 'profile')`   |
| trocar perfil               | `PATCH /users/{id}/profile`  | `{ profile }`                                  | `invalidateAfter(..., 'profile')`   |
| remover do espaço           | `DELETE /users/{id}/profile` | —                                              | `invalidateAfter(..., 'profile')`   |
| renomear espaço             | `PATCH /workspaces/{id}`     | `{ name }`                                     | `invalidateAfter(..., 'workspace')` |

- A linha `profile` da tabela de invalidação da spec 0009 passa a invalidar também
  `['workspaces', 'list']`, porque a aprovação em espaço novo cria um espaço e muda a contagem de
  membros.
- A linha nova `workspace` invalida `['workspaces', 'list']`, `['users', 'list']` e
  `['users', 'me']`, porque o nome aparece na lista e no menu.
- `GET /workspaces` só é chamado ao abrir o diálogo de aprovação ou a lista de espaços.

### Lista de usuários

A lista da spec 0010 ganha uma coluna, entre **Perfil** e **Desde**:

| Coluna (tablet/desktop) | Conteúdo                                          |
| ----------------------- | ------------------------------------------------- |
| Espaço                  | `workspace.name`; vazio para quem está aguardando |

- No cartão do celular, o espaço vai na segunda linha, depois do email: "<email> · <espaço>".
- As ações não mudam: **Liberar acesso** para quem está aguardando, **Alterar perfil** para os
  membros, e nenhuma na própria linha.
- Acima da lista, ao lado do filtro, o botão **Espaços** abre o painel de espaços.

### Diálogo de aprovação (**Liberar acesso**)

`FormDialog` "Liberar acesso de <nome>", com um grupo de rádios **Onde** e o que cada escolha pede:

| Onde                 | Campos                                                                                                                                                       | Corpo enviado                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **Novo espaço**      | **Nome do espaço** (texto, 1 a 80 caracteres, sugestão inicial: o nome do usuário); o perfil é fixo, com o texto "<nome> será o administrador deste espaço." | `{ profile: 'ADMIN', newWorkspace: { name } }` |
| **Espaço existente** | **Espaço** (`Select` com os espaços de `GET /workspaces`, "<nome> (n membros)") e os três perfis da spec 0010                                                | `{ profile, workspaceId }`                     |

- **Novo espaço** vem marcado. **Salvar** fica desabilitado enquanto faltar o nome ou o espaço.
- O nome é aparado nas pontas antes do envio; vazio depois de aparar é erro de campo "Informe o
  nome do espaço.".
- Sucesso: `Notice` "Acesso de <nome> liberado no espaço <espaço>.".

### Diálogo de perfil (**Alterar perfil**)

O diálogo da spec 0010 continua igual para quem já é membro, com o espaço no título: "Alterar
perfil de <nome> em <espaço>". Envia `{ profile }`.

- **Revogar acesso** vira **Remover do espaço**, com o `ConfirmDialog` "<nome> sai do espaço
  <espaço> e volta para a tela de aguardando aprovação. Os registros do espaço continuam lá." e o
  botão **Remover**.
- Sucesso: `Notice` "Perfil de <nome> atualizado." ou "<nome> removido do espaço <espaço>.".

### Painel de espaços

`FormDialog` "Espaços", aberto pelo botão **Espaços** ou por `?espacos=1`:

- `EntryList` com **Nome** e **Membros** (`memberCount`), na ordem da API (`name`).
- Cada linha tem **Renomear**, que troca o nome por um campo de texto em linha, com **Salvar** e
  **Cancelar**. O nome segue a mesma regra do diálogo de aprovação.
- Sucesso: `Notice` "Espaço renomeado para <nome>.".

### Mapa de erros

| Código                       | Onde / comportamento                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `WORKSPACE_NOT_FOUND`        | alerta no diálogo; a lista de espaços é recarregada        |
| `USER_ALREADY_IN_WORKSPACE`  | alerta no diálogo; a lista de usuários é recarregada       |
| `LAST_WORKSPACE_ADMIN`       | alerta no diálogo, que continua aberto; nada muda na lista |
| `CANNOT_CHANGE_OWN_PROFILE`  | como na spec 0010                                          |
| `USER_NOT_FOUND`             | como na spec 0010                                          |
| `VALIDATION_ERROR` em `name` | erro no campo **Nome do espaço**                           |
| `FORBIDDEN`                  | regra da spec 0009 (invalida `['users', 'me']`)            |

Catálogo:

- novos:
    - `WORKSPACE_NOT_FOUND` → "Não encontramos esse espaço. Atualize a página e tente de novo.";
    - `USER_ALREADY_IN_WORKSPACE` → "Esse usuário já está em um espaço. Remova-o antes de
      colocá-lo em outro.";
    - `LAST_WORKSPACE_ADMIN` → "Esse espaço ficaria sem administrador. Mantenha ao menos um.";
- removido: `LAST_ADMIN`, que o backend deixa de devolver.

## Invariants

- **INV-0021-01:** só quem tem `isPlatformAdmin` vê o item **Usuários**, a tela, o painel de
  espaços e os controles de escrita de bancos e de tipos; os demais não disparam `GET /users` nem
  `GET /workspaces`.
- **INV-0021-02:** o frontend nunca envia `workspaceId` fora das rotas de usuário e de espaço, e
  nunca filtra registro por espaço: o isolamento é do backend.
- **INV-0021-03:** o corpo da aprovação tem sempre exatamente uma das formas da tabela, e
  **Novo espaço** envia sempre `profile: 'ADMIN'`.
- **INV-0021-04:** depois de aprovar, trocar, remover ou renomear, a lista e o menu refletem a
  resposta do backend, nunca uma atualização otimista (extensão do INV-0010-03).

## Error cases

| Código      | Situação                                                                                       | Comportamento exigido                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ERR-0021-01 | Erros do mapa                                                                                  | conforme o mapa                                                                                 |
| ERR-0021-02 | `GET /workspaces` falha                                                                        | ERR-0009-01 dentro do diálogo; **Espaço existente** fica desabilitado, **Novo espaço** continua |
| ERR-0021-03 | Usuário sem espaço e sem a marca                                                               | tela de aguardando aprovação (spec 0006)                                                        |
| ERR-0021-04 | Admin da plataforma sem espaço numa tela de domínio, ou `403 PROFILE_PENDING` recebido por ele | `EmptyState` `sem-espaco`, sem ir para `/aguardando-aprovacao`                                  |

## Acceptance criteria

- **AC-0021-01:** com o usuário `ativo` (admin da plataforma), `/usuarios` mostra a coluna
  **Espaço**; com `lancador` e `leitor`, o item **Usuários** não existe e `/usuarios` mostra o
  estado sem acesso, sem `GET /users`. Um `ADMIN` de espaço sem a marca também não vê o item.
- **AC-0021-02:** **Liberar acesso** com **Novo espaço** e o nome "Casa" envia
  `{ "profile": "ADMIN", "newWorkspace": { "name": "Casa" } }`; a linha passa a mostrar
  Administrador e "Casa".
- **AC-0021-03:** **Liberar acesso** com **Espaço existente**, o espaço "Principal" e Leitor envia
  `{ "profile": "VIEWER", "workspaceId": "<id>" }`.
- **AC-0021-04:** **Alterar perfil** de um membro envia só `{ "profile" }`, e o título traz o
  espaço. **Remover do espaço** pede confirmação, envia `DELETE /users/{id}/profile` e a linha
  passa a mostrar **Aguardando**, sem espaço.
- **AC-0021-05:** `409 LAST_WORKSPACE_ADMIN` e `409 USER_ALREADY_IN_WORKSPACE` mostram a mensagem
  do catálogo no diálogo.
- **AC-0021-06:** o painel **Espaços** lista os espaços com a contagem de membros; **Renomear**
  envia `PATCH /workspaces/{id}` com `{ "name" }`, e o menu do usuário passa a mostrar o nome novo
  quando o espaço é o dele.
- **AC-0021-07:** o menu do usuário mostra "Espaço: <nome>" para quem é membro.
- **AC-0021-08:** com `lancador` e com um `ADMIN` de espaço sem a marca, as telas de bancos e de
  tipos de despesa e de receita mostram a lista sem **Novo**, **Editar**, **Renomear** nem
  **Arquivar**, e `?novo=1` não abre o formulário. Com `ativo`, os controles aparecem.
- **AC-0021-09:** nos três projetos do e2e, o diálogo de aprovação segue o `FormDialog`, e a
  coluna **Espaço** aparece na tabela (`tablet`, `desktop`) e na segunda linha do cartão
  (`celular`).
- **AC-0021-10:** com o usuário `admin-sem-espaco` (`workspace: null`, `isPlatformAdmin: true`),
  nenhuma rota leva a `/aguardando-aprovacao`; `/` leva a `/usuarios`, que lista os usuários;
  `/contas/bancos` mostra **Novo banco**; `/despesas` mostra o `EmptyState` `sem-espaco` com
  **Ir para Usuários**, sem chamar `GET /expenses`; a navegação mostra só **Usuários** e os
  catálogos, e o menu do usuário não mostra a linha do espaço.
- **AC-0021-11:** `sources.json` aponta para a tag `v1.5.0` do backend; o catálogo traduz os três
  códigos novos e não tem mais `LAST_ADMIN`.

## Test mapping

| Item                                | Teste                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| AC-0021-01, INV-0021-01             | `e2e/workspaces.spec.ts`, `src/app/shell/navigation.test.ts` e `src/api/permissions.test.tsx`        |
| AC-0021-02, AC-0021-03, INV-0021-03 | `src/features/identity/users-admin/approve-dialog.test.tsx` e `e2e/workspaces.spec.ts`               |
| AC-0021-04, AC-0021-05, INV-0021-04 | `src/features/identity/users-admin/profile-dialog.test.tsx`                                          |
| AC-0021-06                          | `src/features/identity/users-admin/workspaces-panel.test.tsx`                                        |
| AC-0021-07                          | `src/app/shell/user-menu.test.tsx`                                                                   |
| AC-0021-08, INV-0021-02             | `src/features/accounts/banks-page.test.tsx`, os testes das telas de tipos e `e2e/workspaces.spec.ts` |
| AC-0021-09                          | `e2e/workspaces.spec.ts` (três projetos)                                                             |
| AC-0021-10                          | `e2e/workspaces.spec.ts`, `src/app/routes/guard.test.ts` e `src/app/shell/navigation.test.ts`        |
| AC-0021-11                          | gate de contrato (spec 0002) e `src/api/errors/catalog.test.ts`                                      |

## Open questions

Nenhuma.
