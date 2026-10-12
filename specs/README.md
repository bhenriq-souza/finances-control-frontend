# Specs

Specs normativas deste repositório. Processo, template e ciclo de vida em [0000](0000-spec-process.md).

Faixas: `0000`–`0009` processo e plataforma · `0010`+ telas de domínio, com o número da spec de domínio do backend que elas consomem.

| ID                                   | Título                                                             | Status      |
| ------------------------------------ | ------------------------------------------------------------------ | ----------- |
| [0000](0000-spec-process.md)         | Processo de specs e convenções                                     | approved    |
| [0001](0001-development-workflow.md) | Fluxo de desenvolvimento (branches, commits, pull requests)        | approved    |
| [0002](0002-quality-gates.md)        | Portões de qualidade e orquestrador único                          | approved    |
| [0003](0003-scaffold.md)             | Scaffold, estrutura de pastas e configuração de runtime            | implemented |
| [0004](0004-theme.md)                | Tema gerado do tokens.json do hub                                  | approved    |
| [0005](0005-api-client.md)           | Cliente da API gerado do contrato e erros por code                 | approved    |
| [0006](0006-auth-and-shell.md)       | Autenticação, estados da conta e app shell                         | approved    |
| [0007](0007-publication.md)          | Publicação — imagem nginx, configuração em runtime e deploy em dev | implemented |
| [0008](0008-money.md)                | Dinheiro no cliente — parser e formatação BRL em centavos          | approved    |

Specs de tela planejadas: `0010`+, depois das de fundação, com o número da spec de domínio do backend correspondente.

Decisões de arquitetura: as de **produto** vivem em [`docs/adr/` do hub](https://github.com/bhenriq-souza/finances-control/tree/main/docs/adr); as **locais do frontend**, em `adr/` (ainda vazia).
