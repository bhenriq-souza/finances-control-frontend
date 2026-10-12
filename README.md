# finances-control-frontend

SPA do **FTech Finance** — controle financeiro pessoal e familiar da FarmTech (Finances Control nos repositórios).

- Stack ([ADR-0001](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0001-frontend.md)): React 19 + Vite, SPA pura; TanStack Router e Query; react-hook-form + zod; Tailwind + shadcn/ui; cliente da API gerado do contrato OpenAPI do backend; imagem estática em nginx.
- Publicação: mesma origem do backend — `/` é este app, `/api` é o [finances-control-backend](https://github.com/bhenriq-souza/finances-control-backend) — em `finances.dev.homelab.local`, app-name `finances-frontend` no [homelab-gitops](https://github.com/bhenriq-souza/homelab-gitops).
- Produto, requisitos, ADRs, roadmap e identidade visual: repositório hub [finances-control](https://github.com/bhenriq-souza/finances-control).

## Desenvolvimento

Repositório **spec-driven** e implementado por agentes: leia o [`AGENTS.md`](AGENTS.md) antes de qualquer mudança. Specs em [`specs/`](specs/), fila de trabalho em [`docs/backlog.md`](docs/backlog.md).

```bash
npm ci
npm run check   # todos os portões de qualidade — o mesmo comando do CI (spec 0002)
```
