---
id: '0008'
title: Dinheiro no cliente — parser e formatação BRL em centavos
status: approved
depends_on: ['0000', '0003']
---

# 0008 — Dinheiro no Cliente: Parser e Formatação BRL em Centavos

## Goal

Dar ao frontend o único caminho entre o que o usuário digita ou lê e o inteiro de centavos que a API transporta ([ADR-0007](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0007-monetary-representation.md)): um parser do formato brasileiro (`1.234,56` → `123456`), a formatação `R$ 1.234,56` com o sinal da identidade visual, e um campo de formulário que usa os dois — sem ponto flutuante em nenhum passo (INV-0000-04).

## Scope / Non-goals

- **Em escopo:** `src/shared/money/` (tipo, parser, formatação); o componente de exibição `Money` e o campo `MoneyInput` em `src/ui/`; o schema zod de valor monetário para formulários; a regra de lint contra `parseFloat`, `Number()`, `toFixed` e `Math.round` sobre valores monetários.
- **Fora de escopo:** rateio de parcelas e arredondamento half-up, que o backend faz (ADR-0007, itens 3 e 4) — o frontend só mostra o que a API devolve; multi-moeda (BRL implícito); importação de planilha (FCB-013, fora da v1).

## Contracts

### Tipo

```ts
/** Inteiro de centavos, como na API (`amountCents`). */
type Cents = number;
```

O limite é o do banco: `numeric(14,2)`, ou seja `|valor| ≤ 99_999_999_999_999` centavos (R$ 999.999.999.999,99), abaixo de `Number.MAX_SAFE_INTEGER`. `isCents(value)` confere `Number.isSafeInteger` e o limite.

### Parser — `parseBRL(text: string): ParseResult`

```ts
type ParseResult =
    { ok: true; cents: Cents } | { ok: false; reason: 'vazio' | 'formato' | 'limite' };
```

Trabalha só sobre a string, com dígitos e aritmética inteira — nunca `parseFloat`, `Number()` sobre texto com vírgula, nem divisão.

- Remove espaços nas pontas, um prefixo `R$` opcional (com ou sem espaço) e espaços internos entre `R$` e o número.
- **Aceita:** `1234`, `1234,5`, `1234,56`, `1.234`, `1.234,56`, `0,99`, `,99`, `R$ 1.234,56`.
- **Separador de milhar** `.`, opcional, mas, se usado, em grupos de exatamente três dígitos (`1.234.567,89`); `12.34` é `formato`.
- **Decimal** com `,` e no máximo dois dígitos; um dígito vale dezenas de centavos (`1,5` → `150`).
- **Sinal:** não aceita `-` nem `+`. O sinal de um lançamento vem do seu tipo (despesa ou receita), não do valor digitado.
- `''` ou só espaços → `vazio`; acima do limite → `limite`; qualquer outra coisa → `formato`.

### Formatação — `formatBRL(cents: Cents, options?: { sign?: 'auto' | 'always' | 'never' }): string`

- Usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` (ADR-0007, item 7), alimentado com a **string decimal** exata montada por aritmética inteira (`"1234.56"`), nunca com `cents / 100`.
- Resultado: `R$ 1.234,56` — o espaço entre `R$` e o número é normalizado para espaço comum (o `Intl` usa espaço sem quebra, U+00A0), para que textos e testes comparem igual.
- **Sinal** (identidade visual: sinal antes do `R$`, `+` receita, `−` despesa):
    - `auto` (padrão): `−R$ 12,30` para negativos (U+2212, sinal de menos), nada para zero e positivos;
    - `always`: `+R$ 12,30`, `−R$ 12,30`, e `R$ 0,00` sem sinal;
    - `never`: sempre sem sinal (valor absoluto).
- `-0` formata como `R$ 0,00`.
- Valor fora de `isCents` lança `RangeError` — é erro de programação, não de usuário.

### Exibição — `Money` (`src/ui/money.tsx`)

`<Money cents={…} sign="auto|always|never" tone="auto|neutral" />`: renderiza `formatBRL` com algarismos tabulares (`font-variant-numeric: tabular-nums`) e o estilo de dinheiro do tema (spec 0004). Com `tone="auto"`, positivo em `positivo` e negativo em `negativo`; a cor nunca vai sem o sinal (identidade visual), então `tone="auto"` exige `sign` diferente de `never`.

### Entrada — `MoneyInput` e `moneySchema`

- `MoneyInput` é um campo de texto com `inputMode="decimal"`, prefixo visual `R$`, que guarda o texto digitado e entrega centavos ao formulário. Ao perder o foco, reformata o texto válido (`1234,5` → `1.234,50`).
- `moneySchema` (zod) transforma a string do campo em `Cents` por `parseBRL`, com as mensagens pt-BR: `vazio` → "Informe o valor."; `formato` → "Use o formato 1.234,56."; `limite` → "Valor acima do permitido.". Variantes `.positive()` (padrão para lançamentos: zero → "O valor precisa ser maior que zero.") e `.nonnegative()`.

### Regra de lint

No gate `lint`, para `src/**` exceto `src/shared/money/**`: proibir `parseFloat`, `Number.parseFloat`, chamadas de `.toFixed(` e `Math.round(` (seletores do `no-restricted-syntax`, com a mensagem apontando esta spec). `Number(` e `parseInt` continuam permitidos para inteiros que não sejam dinheiro, e a revisão garante o resto.

## Invariants

- **INV-0008-01:** `parseBRL` e `formatBRL` não usam ponto flutuante em nenhum passo: só string, dígitos e inteiros seguros.
- **INV-0008-02:** para todo `cents` em `isCents` com `cents ≥ 0`, `parseBRL(formatBRL(cents, { sign: 'never' }))` devolve `{ ok: true, cents }`.
- **INV-0008-03:** a cor de um valor nunca aparece sem o sinal correspondente.
- **INV-0008-04:** nenhum código fora de `src/shared/money/` converte texto em valor monetário.

## Error cases

| Código      | Situação                       | Comportamento exigido                                      |
| ----------- | ------------------------------ | ---------------------------------------------------------- |
| ERR-0008-01 | Campo vazio                    | `vazio` → "Informe o valor."                               |
| ERR-0008-02 | Texto fora do formato          | `formato` → "Use o formato 1.234,56."                      |
| ERR-0008-03 | Acima de R$ 999.999.999.999,99 | `limite` → "Valor acima do permitido."                     |
| ERR-0008-04 | Zero onde o valor deve ser > 0 | "O valor precisa ser maior que zero."                      |
| ERR-0008-05 | `formatBRL` com valor inválido | `RangeError` (erro de programação; nunca chega ao usuário) |

## Acceptance criteria

- **AC-0008-01:** `parseBRL` devolve `123456` para `1.234,56`, `R$ 1.234,56` e `1234,56`; `150` para `1,5`; `99` para `,99`; `100` para `1`; e `formato` para `12.34`, `1,234`, `1.2345,00`, `-10`, `1e3` e `abc`.
- **AC-0008-02:** `parseBRL('999.999.999.999,99')` aceita e `parseBRL('1.000.000.000.000,00')` devolve `limite`.
- **AC-0008-03:** `formatBRL(123456)` é `R$ 1.234,56`; `formatBRL(-1230)` é `−R$ 12,30`; `formatBRL(1230, { sign: 'always' })` é `+R$ 12,30`; `formatBRL(0, { sign: 'always' })` é `R$ 0,00`; `formatBRL(99_999_999_999_999)` é `R$ 999.999.999.999,99`.
- **AC-0008-04:** o teste de propriedade de INV-0008-02 passa em 10.000 valores aleatórios e nos limites.
- **AC-0008-05:** `MoneyInput` com `moneySchema.positive()` entrega `123450` ao submeter `1234,5`, reformata para `1.234,50` ao perder o foco e mostra as mensagens de ERR-0008-01, 02 e 04.
- **AC-0008-06:** um `parseFloat` ou `toFixed` em `src/features/` faz o gate `lint` falhar citando esta spec.

## Test mapping

| Item                                | Teste                                                   |
| ----------------------------------- | ------------------------------------------------------- |
| AC-0008-01, AC-0008-02, INV-0008-01 | `src/shared/money/parse.test.ts`                        |
| AC-0008-03, INV-0008-01             | `src/shared/money/format.test.ts`                       |
| AC-0008-04, INV-0008-02             | `src/shared/money/roundtrip.test.ts` (com `fast-check`) |
| AC-0008-05, INV-0008-03             | `src/ui/money.test.tsx` e `src/ui/money-input.test.tsx` |
| AC-0008-06, INV-0008-04             | regra de lint e prova manual no PR                      |

## Open questions

Nenhuma.
