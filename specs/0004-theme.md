---
id: '0004'
title: Tema gerado do tokens.json do hub
status: implemented
depends_on: ['0002', '0003']
---

# 0004 — Tema Gerado do `tokens.json` do Hub

## Goal

Tornar o `tokens.json` aprovado no hub ([identidade visual](https://github.com/bhenriq-souza/finances-control/blob/main/docs/design/visual-identity.md), FC-006) a única fonte do tema do Tailwind e do shadcn/ui: um gerador transforma os tokens em CSS, o resultado é commitado, o gate `contract` reprova qualquer divergência entre os dois, o gate `test` confere o contraste, e o usuário escolhe entre o tema do sistema, o escuro e o claro.

## Scope / Non-goals

- **Em escopo:** a fonte fixada em `sources.json`; o gerador `scripts/theme.mjs` e o script `npm run theme`; o arquivo gerado `src/ui/theme/tokens.css` e o seu formato; o mapeamento para as variáveis do shadcn/ui e para o `@theme` do Tailwind v4; fontes; a escolha de tema (`ThemeProvider`); o teste de contraste; os passos 1 e 3 do gate `contract` para a fonte `tokens`.
- **Fora de escopo:** mudar a identidade (nasce no Design System e chega aqui pelo hub, como manda a seção _Como mudar_ da identidade visual); os componentes do Design System (`Money`, `StatusBadge`, `EntryList`, `AppShell`), que entram com as telas que os usam; ícones (lucide, já no kit da spec 0003).

## Contracts

### Fonte

`sources.json`, entrada `tokens` (formato na spec 0002): repositório `bhenriq-souza/finances-control`, `path` `docs/design/tokens.json`, `ref` = o commit do hub que contém a versão aprovada (hoje `9104278508cfafe19eb878a6da987bc7249348bb`, merge do PR #22, Design System `1791756594-5be0`) e o `sha256` do arquivo nesse commit (`ace7761fa3f3a26fd689d5545aab57a66003897a4bbb6659795bd99a992cdade`).

O `tokens.json` está no formato do Design System do Claude: `color` (`themes` `escuro` e `claro`, 26 `tokens` com `value` fixo ou por tema e aliases `{outro-token}`), `type` (`families` `sans` e `mono`, `groups` de estilos), `spacing`, `radius`, `shadow` (por tema) e `breakpoint`.

### Gerador

`scripts/theme.mjs`:

- exporta `generateTheme(tokens, source): string` — função pura, usada pelo gate `contract` e pelos testes;
- executado (`npm run theme`), baixa a fonte de `sources.json`, confere o `sha256` e grava `src/ui/theme/tokens.css`;
- falha, sem gravar, se um alias não resolver, se um token de cor não tiver valor para os dois temas, ou se um nome de token não for `[a-z0-9-]+`.

### Arquivo gerado — `src/ui/theme/tokens.css`

Commitado, ignorado pelo Prettier e nunca editado à mão. Ordem e conteúdo:

1. **Cabeçalho:** `/* Gerado por scripts/theme.mjs — não edite. Fonte: <repositório>@<ref> (<path>), sha256 <hash>. */`
2. **Cores por tema**, em variáveis com o prefixo `--ft-` e o nome do token, aliases já resolvidos para hexadecimal:
    - `:root, :root[data-tema='escuro']` — tema escuro, a referência;
    - `:root[data-tema='claro']` — tema claro;
    - `@media (prefers-color-scheme: light) { :root:not([data-tema]) { … } }` — tema claro quando o usuário segue o sistema.
    - Os sete `marca-*` não geram variável: a interface nunca os usa direto (identidade visual).
    - `sombra-flutuante` entra por tema, como `--ft-sombra-flutuante`.
3. **Variáveis do shadcn/ui**, no `:root`, apontando para as semânticas:

    | shadcn/ui                                       | token                |
    | ----------------------------------------------- | -------------------- |
    | `--background`                                  | `fundo`              |
    | `--foreground`                                  | `texto`              |
    | `--card`, `--popover`                           | `superficie`         |
    | `--card-foreground`, `--popover-foreground`     | `texto`              |
    | `--primary`                                     | `acento`             |
    | `--primary-foreground`                          | `sobre-acento`       |
    | `--secondary`, `--muted`, `--accent`            | `superficie-elevada` |
    | `--secondary-foreground`, `--accent-foreground` | `texto`              |
    | `--muted-foreground`                            | `texto-apoio`        |
    | `--destructive`                                 | `negativo`           |
    | `--border`                                      | `linha`              |
    | `--input`                                       | `linha-forte`        |
    | `--ring`                                        | `foco`               |
    | `--radius`                                      | `raio-md`            |

4. **`@theme inline`** do Tailwind v4:
    - `--color-<token>: var(--ft-<token>)` para cada cor semântica, e `--color-<shadcn>` para cada variável da tabela acima — assim `bg-superficie`, `text-texto-apoio` e `bg-primary` funcionam;
    - `--font-sans` e `--font-mono` com as famílias de `type.families`;
    - `--spacing: 4px` (base de 4px; `p-4` = 16px = `espaco-4`);
    - `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full` com os `raio-*`;
    - `--breakpoint-md` e `--breakpoint-lg` com `bp-tablet` (768px) e `bp-desktop` (1024px);
    - `--text-<estilo>` com `--line-height`, `--font-weight` e `--letter-spacing` para cada estilo de `type.groups` (`display`, `titulo-1`…`rotulo` e os de dinheiro).

`src/index.css` importa `tailwindcss`, `tokens.css` e as fontes, e só isso.

### Fontes

Outfit e JetBrains Mono, pesos 400, 500 e 600, empacotadas pelo `@fontsource` (`@fontsource/outfit`, `@fontsource/jetbrains-mono`) em vez do Google Fonts que o Design System cita: o app não faz requisição a terceiros para renderizar, e as fontes ficam no cache longo dos assets com hash (spec 0007). Os arquivos de fonte não entram no orçamento de CSS do gate `build`, que mede só `.css`.

### Escolha de tema

`src/ui/theme/theme-provider.tsx`:

- três opções: `sistema` (padrão), `escuro` e `claro`, guardadas em `localStorage` na chave `ftech.tema`;
- `escuro` e `claro` gravam `data-tema` no `<html>`; `sistema` remove o atributo e deixa o `prefers-color-scheme` decidir;
- um script inline no `index.html` aplica a escolha guardada antes da primeira pintura, para não piscar o tema errado;
- `useTheme(): { tema, setTema }` é a única API; o seletor visual entra no app shell (spec 0006).

### Contraste

`src/ui/theme/contrast.test.ts` lê `tokens.css`, resolve as variáveis de cada tema e confere os mesmos 30 pares do `check-contrast.mjs` do hub, nos dois temas (60 verificações): 4,5:1 para texto, 3:1 para `linha-forte` e `foco`. A lista de pares é cópia literal da do hub; mudar a lista exige mudar o hub primeiro.

### Atualizar o tema

1. O hub aprova uma versão nova do `tokens.json` (identidade visual, _Como mudar_).
2. Num PR deste repositório: mudar `ref` e `sha256` da entrada `tokens` de `sources.json`, rodar `npm run theme` e commitar o `tokens.css` novo.
3. `npm run check`: o `contract` confere a sincronia e o `test`, o contraste.

## Invariants

- **INV-0004-01:** `tokens.css` é sempre igual a `generateTheme` aplicado à fonte fixada em `sources.json` (verificado pelo gate `contract`, INV-0002-07).
- **INV-0004-02:** nenhum componente usa cor literal (`#…`, `rgb(…)`, classes de paleta do Tailwind como `bg-green-500`) nem variável `--ft-marca-*`; só utilitários e variáveis semânticos.
- **INV-0004-03:** os 30 pares de contraste passam nos dois temas.
- **INV-0004-04:** a escolha `sistema` acompanha o `prefers-color-scheme` sem recarregar a página.

## Error cases

| Código      | Situação                                        | Comportamento exigido                                                 |
| ----------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| ERR-0004-01 | Alias que não resolve ou cor sem os dois temas  | `npm run theme` e o `contract` falham citando o token; nada é gravado |
| ERR-0004-02 | `tokens.css` editado à mão ou `ref` sem regerar | `contract` FAIL (ERR-0002-08)                                         |
| ERR-0004-03 | Par abaixo do mínimo                            | `test` FAIL citando tema, par, razão obtida e mínimo                  |
| ERR-0004-04 | `localStorage` indisponível ou valor inválido   | tema `sistema`, sem erro visível                                      |

## Acceptance criteria

- **AC-0004-01:** `npm run theme` com a fonte de `sources.json` gera `tokens.css` com as 19 cores semânticas nos dois temas, as variáveis do shadcn/ui e o `@theme` descritos, e uma segunda execução não muda o arquivo.
- **AC-0004-02:** o gate `contract` é PASS com o `tokens.css` gerado e FAIL com uma cor editada à mão (prova da AC-0002-07 para o tema).
- **AC-0004-03:** o teste de contraste roda os 60 pares e falha se `texto-apoio` do tema claro for trocado por `#9aa69d` (a névoa, 2,3:1).
- **AC-0004-04:** com `prefers-color-scheme: light` emulado e a escolha `sistema`, a página usa as cores do tema claro; com `escuro` escolhido, usa as do escuro mesmo com o sistema claro; a escolha sobrevive a um recarregamento.
- **AC-0004-05:** um componente com `bg-[#a6e86b]` ou `text-green-600` faz o gate `lint` falhar (regra que proíbe cor literal e paleta do Tailwind em `className`).

## Test mapping

| Item                    | Teste                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| AC-0004-01, INV-0004-01 | `scripts/theme.test.mjs` (gerador puro, com um `tokens.json` de fixture) |
| AC-0004-02              | prova manual no PR e testes de `scripts/contract.mjs`                    |
| AC-0004-03, INV-0004-03 | `src/ui/theme/contrast.test.ts`                                          |
| AC-0004-04, INV-0004-04 | `src/ui/theme/theme-provider.test.tsx` e `e2e/theme.spec.ts`             |
| AC-0004-05, INV-0004-02 | regra de lint e prova manual no PR                                       |

## Open questions

Nenhuma.
