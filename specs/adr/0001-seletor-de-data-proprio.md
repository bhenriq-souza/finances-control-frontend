---
id: '0001'
title: Seletor de data próprio, com calendário
status: accepted
---

# ADR-0001 (local) — Seletor de data próprio, com calendário

## Context

A spec 0009 escolheu o `<input type="date">` nativo para o `DateField`: o valor já é `YYYY-MM-DD`, sem conversão e sem dependência. Nos testes em `dev` (2026-10-13), o responsável encontrou três problemas, todos do controle nativo:

- no Firefox para Android o seletor é ruim de usar, justamente nas telas mais usadas (nova despesa e nova receita);
- no celular o campo desalinha em algumas telas, porque cada navegador desenha o controle com largura e alinhamento próprios;
- no tema escuro o ícone do calendário ficava preto (corrigido pelo `color-scheme` da spec 0004, mas o desenho continua sendo do navegador, não do Design System).

O responsável decidiu por um seletor próprio e perguntou se a biblioteca de estilo do projeto tem um. O kit do [ADR-0001 do hub](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0001-frontend.md) é shadcn/ui, que oferece o componente **Calendar** sobre `react-day-picker` e o padrão **Date Picker** (calendário num `Popover` do Radix).

## Decision

1. O `DateField` passa a ser um campo de **texto** com máscara `dd/mm/aaaa` e um botão que abre um **calendário** em pt-BR — o padrão Date Picker do shadcn/ui, copiado para `src/ui/` e desenhado só com os tokens do tema, como os demais componentes.
2. Dependências novas: `react-day-picker` (o Calendar do shadcn/ui; traz `date-fns` como dependência dele) e `@radix-ui/react-popover` (o balão no tablet e no desktop). No celular o calendário abre numa folha sobre `@radix-ui/react-dialog`, que já é dependência.
3. O valor no formulário continua `YYYY-MM-DD`, o formato da API (INV-0009-05): a máscara e o calendário são só apresentação. O fuso e o "hoje" continuam vindo de `src/shared/dates/`; `date-fns` não é usado fora do calendário.
4. O código do calendário é carregado só quando o usuário o abre (import dinâmico), para não pesar no JS inicial nem nos chunks das rotas (orçamento de bundle da spec 0002).

## Consequences

- Mesmo desenho e mesmo comportamento em todos os navegadores, inclusive o Firefox para Android; o campo segue o tema e os tokens.
- Digitar continua sendo o caminho mais rápido: a máscara aceita só números e põe as barras; colar `aaaa-mm-dd` também funciona.
- O `DateField` deixa de ser registrado com `register` e passa a ser controlado (`useController`), então todos os formulários que usam data mudam, e os testes que preenchiam o campo nativo com `aaaa-mm-dd` passam a digitar no campo de texto.
- Data incompleta ou inexistente (`31/02/2026`) precisa de validação própria: os schemas dos formulários passam a validar datas por um helper comum em `src/shared/dates/`.
- Três pacotes a mais no `npm audit` do gate `audit`.

## Alternatives considered

- **Manter o nativo e corrigir só o CSS:** resolve o alinhamento, mas não o uso no Firefox para Android, que é o motivo principal.
- **Calendário escrito do zero:** sem dependência, mas é o componente mais difícil de acertar em acessibilidade (navegação por teclado na grade, anúncio do mês, foco); `react-day-picker` já resolve isso e é o que o shadcn/ui usa.
- **Biblioteca de componentes de data fechada (MUI X, Mantine Dates):** traz o tema da biblioteca junto, o que o ADR-0001 do hub já recusou para o kit.
