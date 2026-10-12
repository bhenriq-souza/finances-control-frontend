import { createFileRoute, notFound } from '@tanstack/react-router';

/**
 * Layout das páginas de prova do e2e (`/_e2e/*`, spec 0009): componentes do `ui` com dados
 * estáticos, sem sessão nem API, para provar no navegador o que só se prova nos três tamanhos de
 * tela.
 *
 * Como uma página de prova fica fora do build de produção:
 * - o `_` inicial faria do segmento um layout sem caminho no roteador; `[_]e2e` o escapa, e a URL
 *   é literalmente `/_e2e/...`;
 * - fora do modo `e2e`, `beforeLoad` responde "não encontrado", como uma URL desconhecida;
 * - cada rota filha (`[_]e2e/<nome>.tsx`) só declara o caminho e carrega a página de
 *   `[_]e2e/-<nome>-page.tsx` (o `-` faz o gerador ignorar o arquivo) por um `import()` dentro de
 *   `import.meta.env.MODE === 'e2e'`. O Vite troca `MODE` por uma constante e elimina o ramo, então
 *   o build de produção não tem o código da página — como o fake de autenticação (spec 0003);
 * - a página exibe `E2E_PROOF_MARKER` (o mesmo marcador do fake), e o gate `build` falha se ele
 *   aparecer em `dist/`.
 *
 * Para uma página nova (ex.: `/_e2e/formulario`), copie `[_]e2e/lista.tsx` e
 * `[_]e2e/-lista-page.tsx` com o novo nome.
 */
export const Route = createFileRoute('/_e2e')({
    beforeLoad: () => {
        if (import.meta.env.MODE !== 'e2e') throw notFound();
    },
});
