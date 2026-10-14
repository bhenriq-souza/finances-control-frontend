# Marca da FarmTech

Cópias, sem alteração, dos SVGs de `docs/design/assets/` do hub
[finances-control](https://github.com/bhenriq-souza/finances-control), no commit
`9104278508cfafe19eb878a6da987bc7249348bb` — o mesmo fixado para os tokens do tema (spec 0004).
Não edite nem recolora: para atualizar, copie de novo do hub e troque o commit acima.

| Arquivo                                      | Uso aqui                                    |
| -------------------------------------------- | ------------------------------------------- |
| `farmtech-logo-horizontal-fundo-claro.svg`   | telas de autenticação, tema claro           |
| `farmtech-logo-horizontal-fundo-escuro.svg`  | telas de autenticação, tema escuro          |
| `farmtech-simbolo-compacto-fundo-claro.svg`  | tela de carregamento da guarda, tema claro  |
| `farmtech-simbolo-compacto-fundo-escuro.svg` | tela de carregamento da guarda, tema escuro |

A versão é escolhida pelo tema efetivo (`BrandLogo` e `BrandSymbol` em `brand.tsx`).

## Ícone da aba

`public/favicon.svg` é a cópia, sem alteração, de `docs/design/assets/favicon.svg` do hub, no mesmo
commit `9104278508cfafe19eb878a6da987bc7249348bb`. Dele saem, uma única vez, os PNGs versionados
`public/favicon-32.png` (32×32, fundo transparente) e `public/apple-touch-icon.png` (180×180, fundo
cheio na cor do quadrado do SVG e sem cantos arredondados, porque o iOS arredonda sozinho). Foram
gerados com o Chromium do Playwright: renderizar o SVG na página do tamanho do ícone e tirar a
captura de tela (com `omitBackground` no de 32px). O script não é versionado; ao trocar o commit do
hub, gere os dois PNGs de novo.
