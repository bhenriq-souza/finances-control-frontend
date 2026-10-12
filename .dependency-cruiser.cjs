// Fronteiras entre módulos (spec 0003, tabela "Fronteiras"). Mudar uma regra exige mudar a spec.
// Permitido, por exclusão: features → api, ui, shared; routes → app, features, ui, shared;
// app → tudo; main.tsx → app, shared.

const TEST_FILE = '\\.(test|spec)\\.[cm]?[jt]sx?$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: 'no-cross-feature',
            comment: 'Uma feature nunca importa outra (INV-0003-02).',
            severity: 'error',
            from: { path: '^src/features/([^/]+)/' },
            to: { path: '^src/features/', pathNot: '^src/features/$1/' },
        },
        {
            name: 'feature-public-api',
            comment: 'De fora de uma feature só se importa o index.ts dela (INV-0003-02).',
            severity: 'error',
            from: { path: '^src/features/([^/]+)/' },
            to: {
                path: '^src/features/[^/]+/',
                pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
            },
        },
        {
            name: 'feature-public-api',
            comment: 'De fora de uma feature só se importa o index.ts dela (INV-0003-02).',
            severity: 'error',
            from: { pathNot: '^src/features/' },
            to: {
                path: '^src/features/[^/]+/',
                pathNot: '^src/features/[^/]+/index\\.ts$',
            },
        },
        {
            name: 'shared-is-a-leaf',
            comment: 'src/shared não importa nenhuma outra pasta de src/.',
            severity: 'error',
            from: { path: '^src/shared/' },
            to: { path: '^src/', pathNot: '^src/shared/' },
        },
        {
            name: 'ui-only-shared',
            comment: 'src/ui só importa ui/ e shared/.',
            severity: 'error',
            from: { path: '^src/ui/' },
            to: { path: '^src/', pathNot: '^src/(ui|shared)/' },
        },
        {
            name: 'api-only-shared',
            comment: 'src/api só importa api/ e shared/.',
            severity: 'error',
            from: { path: '^src/api/' },
            to: { path: '^src/', pathNot: '^src/(api|shared)/' },
        },
        {
            name: 'routes-are-thin',
            comment: 'Rotas não importam o cliente da API direto: compõem features.',
            severity: 'error',
            from: { path: '^src/routes/' },
            to: { path: '^src/api/' },
        },
        {
            name: 'nobody-imports-app',
            comment: 'Só main.tsx, routes/ e o próprio app/ importam src/app.',
            severity: 'error',
            from: { pathNot: '^src/(main\\.tsx$|routes/|app/)' },
            to: { path: '^src/app/' },
        },
        {
            name: 'firebase-only-in-identity',
            comment: 'O SDK do Firebase só é importado por src/features/identity (INV-0003-01).',
            severity: 'error',
            from: { pathNot: '^src/features/identity/' },
            // node_modules pode ser um link simbólico (worktrees): o caminho resolvido pode não
            // começar por node_modules/.
            to: { path: '(^|/)node_modules/firebase/' },
        },
        {
            name: 'no-circular',
            comment: 'Ciclos de importação.',
            severity: 'error',
            from: {},
            to: { circular: true },
        },
        {
            name: 'not-to-test-from-src',
            comment: 'Código de src/ não importa arquivo de teste nem de e2e/.',
            severity: 'error',
            from: { path: '^src/', pathNot: TEST_FILE },
            to: { path: [TEST_FILE, '^e2e/'] },
        },
    ],
    options: {
        doNotFollow: { path: 'node_modules' },
        // Importações só de tipo também contam para as fronteiras.
        tsPreCompilationDeps: true,
        // Resolve o alias `@/` (tsconfig.json) — sem isso as regras não veriam essas importações.
        tsConfig: { fileName: 'tsconfig.json' },
        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'node', 'default', 'types'],
            mainFields: ['module', 'main', 'types', 'typings'],
        },
        reporterOptions: {
            text: { highlightFocused: true },
        },
    },
};
