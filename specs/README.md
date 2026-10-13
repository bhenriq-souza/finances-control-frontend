# Specs

Specs normativas deste repositório. Processo, template e ciclo de vida em [0000](0000-spec-process.md).

Faixas: `0000`–`0009` processo e plataforma · `0010`+ telas de domínio, com o número da spec de domínio do backend que elas consomem.

| ID                                       | Título                                                             | Status      |
| ---------------------------------------- | ------------------------------------------------------------------ | ----------- |
| [0000](0000-spec-process.md)             | Processo de specs e convenções                                     | approved    |
| [0001](0001-development-workflow.md)     | Fluxo de desenvolvimento (branches, commits, pull requests)        | approved    |
| [0002](0002-quality-gates.md)            | Portões de qualidade e orquestrador único                          | approved    |
| [0003](0003-scaffold.md)                 | Scaffold, estrutura de pastas e configuração de runtime            | implemented |
| [0004](0004-theme.md)                    | Tema gerado do tokens.json do hub                                  | implemented |
| [0005](0005-api-client.md)               | Cliente da API gerado do contrato e erros por code                 | implemented |
| [0006](0006-auth-and-shell.md)           | Autenticação, estados da conta e app shell                         | implemented |
| [0007](0007-publication.md)              | Publicação — imagem nginx, configuração em runtime e deploy em dev | implemented |
| [0008](0008-money.md)                    | Dinheiro no cliente — parser e formatação BRL em centavos          | implemented |
| [0009](0009-lists-and-reference-data.md) | Listas, formulários e dados de referência compartilhados           | implemented |
| [0010](0010-users-admin.md)              | Administração de usuários e perfis                                 | implemented |
| [0011](0011-accounts.md)                 | Bancos, contas bancárias e cartões de crédito                      | implemented |
| [0012](0012-expenses.md)                 | Despesas e tipos de despesa                                        | implemented |
| [0013](0013-statements.md)               | Faturas de cartão, pagamentos e estornos                           | implemented |
| [0014](0014-earnings.md)                 | Receitas e tipos de receita                                        | implemented |
| [0015](0015-dashboard-and-reports.md)    | Dashboard de saldo e relatórios                                    | implemented |
| [0017](0017-recurrences.md)              | Séries fixas de despesas e receitas                                | implemented |
| [0018](0018-transfers.md)                | Transferências entre contas próprias                               | implemented |

Decisões de arquitetura: as de **produto** vivem em [`docs/adr/` do hub](https://github.com/bhenriq-souza/finances-control/tree/main/docs/adr); as **locais do frontend**, em `adr/` (ainda vazia).
