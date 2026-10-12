---
id: '0010'
title: Administração de usuários e perfis
status: implemented
depends_on: ['0006', '0009']
---

# 0010 — Administração de Usuários e Perfis

## Goal

Dar ao `ADMIN` a tela que fecha o F001: ver quem tem conta na plataforma, liberar o acesso de quem está aguardando aprovação, trocar o perfil de um usuário e revogar o acesso — com o efeito imediato que o backend garante (o usuário afetado passa a valer o perfil novo na próxima requisição, sem novo login).

## Scope / Non-goals

- **Em escopo:** a rota `/usuarios`, o item **Usuários** da navegação, a lista de usuários, os diálogos de conceder/trocar perfil e de revogar acesso, o filtro "Aguardando aprovação".
- **Fora de escopo:** convite, exclusão de usuário, edição do próprio nome, histórico de quem concedeu (a API não oferece nenhum deles); a tela de aguardando aprovação do próprio usuário (spec 0006).
- **Depende do backend:** [spec 0010](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0010-identity.md) na tag `v1.1.0` — `GET /users`, `PATCH /users/{id}/profile` e `DELETE /users/{id}/profile`, só `ADMIN`.
- **Lacunas do contrato `v1.1.0`** (o frontend trata pelo `code`; a correção, quando houver, é do backend, numa tag nova): `GET /users/me` não declara o `403 EMAIL_NOT_VERIFIED` que o backend devolve.
- **Forma visual:** padrão de **cadastro** da spec 0009 e o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC).

## Contracts

### Rota e navegação

| Rota        | Acesso  | Conteúdo                                                           |
| ----------- | ------- | ------------------------------------------------------------------ |
| `/usuarios` | `ADMIN` | lista; `?perfil=<userId>` abre o diálogo de perfil daquele usuário |

- Item de navegação: `{ to: '/usuarios', label: 'Usuários', icon: Users, profiles: ['ADMIN'], slot: 'mais' }` (spec 0009).
- `beforeLoad` confere `can(profile, 'users.manage')`; sem a permissão, `EmptyState` `sem-acesso` (ERR-0009-05).
- Código em `src/features/identity/users-admin/`; a rota só compõe.

### Consultas e escritas

| Operação               | Rota do backend              | Corpo                                          | Chave / invalidação               |
| ---------------------- | ---------------------------- | ---------------------------------------------- | --------------------------------- |
| listar                 | `GET /users`                 | —                                              | `['users', 'list']`               |
| conceder/trocar perfil | `PATCH /users/{id}/profile`  | `{ profile: 'ADMIN' \| 'BILLER' \| 'VIEWER' }` | `invalidateAfter(..., 'profile')` |
| revogar acesso         | `DELETE /users/{id}/profile` | —                                              | `invalidateAfter(..., 'profile')` |

### Lista

- Ordem: primeiro os sem perfil (aguardando), depois os demais; dentro de cada grupo, a ordem da API (`createdAt`).
- Filtro por segmentos acima da lista: **Todos** e **Aguardando aprovação (n)**, este com a contagem; o estado do filtro vai na URL (`?filtro=aguardando`).
- `EntryList` (spec 0009):

| Coluna (tablet/desktop) | Conteúdo                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Nome                    | `name`; "Você" como texto de apoio na linha do próprio ADMIN                                      |
| Email                   | `email`; selo **Email não verificado** (`atencao`) quando `emailVerified` é `false`               |
| Perfil                  | rótulo pt-BR do perfil (`PROFILE_LABELS`) ou o selo **Aguardando**                                |
| Desde                   | `createdAt` em `formatDate(…, 'curta')`; só no desktop (`hideBelow: 'lg'`)                        |
| (ações)                 | **Liberar acesso** (sem perfil) ou **Alterar perfil** (com perfil); nenhuma ação na própria linha |

- Cartão no celular: nome e perfil/selo na primeira linha, email na segunda, a ação como botão de 44px.

### Diálogo de perfil

`FormDialog` com título "Liberar acesso de <nome>" ou "Alterar perfil de <nome>":

- grupo de rádios com os três perfis, cada um com o rótulo e a descrição de [perfis](https://github.com/bhenriq-souza/finances-control/blob/main/docs/user-profiles.md) em uma linha (Administrador: "Tudo, inclusive usuários, bancos, contas e cartões"; Lançador: "Lança e altera despesas, receitas, faturas e transferências"; Leitor: "Só consulta");
- o perfil atual vem marcado; **Salvar** desabilitado enquanto a escolha for igual à atual;
- com perfil, o diálogo traz também **Revogar acesso**, que abre um `ConfirmDialog`: "<nome> volta para a tela de aguardando aprovação e perde o acesso a tudo até receber um perfil de novo." com o botão **Revogar**.
- Sucesso: `Notice` "Perfil de <nome> atualizado." ou "Acesso de <nome> revogado.".

## Invariants

- **INV-0010-01:** só `ADMIN` vê o item **Usuários** e a tela; outro perfil não dispara `GET /users`.
- **INV-0010-02:** a linha do próprio usuário não oferece nenhuma ação (o backend recusa com `CANNOT_CHANGE_OWN_PROFILE`).
- **INV-0010-03:** depois de conceder, trocar ou revogar, a lista reflete a resposta do backend, nunca uma atualização otimista.

## Error cases

| Código      | Situação                                          | Comportamento exigido                                                                         |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ERR-0010-01 | `409 LAST_ADMIN`                                  | mensagem do catálogo no alerta do diálogo; nada muda na lista                                 |
| ERR-0010-02 | `409 CANNOT_CHANGE_OWN_PROFILE`                   | mensagem do catálogo no alerta (não deveria ocorrer pela INV-0010-02)                         |
| ERR-0010-03 | `404 USER_NOT_FOUND`                              | mensagem do catálogo no alerta; a lista é recarregada                                         |
| ERR-0010-04 | `403 FORBIDDEN` (o próprio ADMIN perdeu o perfil) | ERR-0009-03: alerta e `['users', 'me']` invalidado, que leva à tela que o perfil novo permite |
| ERR-0010-05 | `GET /users` falha                                | ERR-0009-01                                                                                   |

## Acceptance criteria

- **AC-0010-01:** com o usuário `ativo` (ADMIN), `/usuarios` lista os usuários do stub com os sem perfil primeiro; com `lancador` e `leitor`, o item **Usuários** não existe e `/usuarios` mostra o estado sem acesso, sem `GET /users`.
- **AC-0010-02:** **Liberar acesso** num usuário sem perfil, escolhendo Lançador, envia `PATCH /users/{id}/profile` com `{ "profile": "BILLER" }` e a linha passa a mostrar "Lançador".
- **AC-0010-03:** **Revogar acesso** pede confirmação, envia `DELETE /users/{id}/profile` e a linha passa a mostrar **Aguardando**.
- **AC-0010-04:** `409 LAST_ADMIN` mostra a mensagem do catálogo no diálogo, que continua aberto.
- **AC-0010-05:** a linha do próprio ADMIN mostra "Você" e nenhuma ação.
- **AC-0010-06:** o filtro **Aguardando aprovação** mostra só os sem perfil e sobrevive a recarregar a página.
- **AC-0010-07:** nos três projetos do e2e, a lista aparece como cartões (`celular`) ou tabela (`tablet`, `desktop`), e o diálogo segue o `FormDialog`.

## Test mapping

| Item                                | Teste                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| AC-0010-01, INV-0010-01             | `e2e/users-admin.spec.ts`                                                               |
| AC-0010-02, AC-0010-03, INV-0010-03 | `e2e/users-admin.spec.ts` e `src/features/identity/users-admin/profile-dialog.test.tsx` |
| AC-0010-04, AC-0010-05, INV-0010-02 | `src/features/identity/users-admin/users-page.test.tsx`                                 |
| AC-0010-06, AC-0010-07              | `e2e/users-admin.spec.ts`                                                               |

## Open questions

Nenhuma.
