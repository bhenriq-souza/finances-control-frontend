import js from '@eslint/js';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'coverage/**',
            'node_modules/**',
            'playwright-report/**',
            'test-results/**',
            'blob-report/**',
            '.claude/worktrees/**',
            // Gerados: pelo plugin do roteador e pelo gate contract (spec 0002).
            'src/routeTree.gen.ts',
            'src/api/generated/**',
        ],
    },
    js.configs.recommended,
    {
        // Scripts de gates e configuração de ferramentas em JavaScript: Node.
        files: ['**/*.{js,mjs}'],
        languageOptions: { sourceType: 'module', globals: globals.node },
    },
    {
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs', globals: globals.node },
    },
    {
        // Configuração de runtime servida como script clássico (spec 0003).
        files: ['public/**/*.js'],
        languageOptions: { sourceType: 'script', globals: globals.browser },
    },
    {
        files: ['**/*.{ts,tsx}'],
        extends: [tseslint.configs.recommended],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        extends: [reactHooks.configs.flat.recommended],
    },
    {
        // Dinheiro só passa pelo parser/formatador da plataforma (spec 0008).
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/shared/money/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.name='parseFloat']",
                    message:
                        'parseFloat é proibido em src/ fora de src/shared/money/: use parseBRL (spec 0008).',
                },
                {
                    selector:
                        "CallExpression[callee.type='MemberExpression'][callee.object.name='Number'][callee.property.name='parseFloat']",
                    message:
                        'Number.parseFloat é proibido em src/ fora de src/shared/money/: use parseBRL (spec 0008).',
                },
                {
                    selector:
                        "CallExpression[callee.type='MemberExpression'][callee.property.name='toFixed']",
                    message:
                        '.toFixed() é proibido em src/ fora de src/shared/money/: use formatBRL (spec 0008).',
                },
                {
                    selector:
                        "CallExpression[callee.type='MemberExpression'][callee.object.name='Math'][callee.property.name='round']",
                    message:
                        'Math.round() é proibido em src/ fora de src/shared/money/: dinheiro é inteiro de centavos (spec 0008).',
                },
            ],
        },
    },
    {
        // Só tokens semânticos na interface: nada de cor literal nem paleta do Tailwind (spec 0004).
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/**/*.test.{ts,tsx}'],
        // Instância própria do no-restricted-syntax: a chave da regra nativa já é usada pelo bloco do
        // dinheiro acima, e uma segunda configuração dela o substituiria em vez de somar.
        plugins: {
            ftech: { rules: { 'no-restricted-syntax': builtinRules.get('no-restricted-syntax') } },
        },
        rules: {
            'ftech/no-restricted-syntax': ['error', ...themeColorRestrictions()],
        },
    },
    prettierConfig,
);

/** Seletores que proíbem cor literal e paleta do Tailwind em strings de classe (INV-0004-02). */
function themeColorRestrictions() {
    const palette =
        'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
    const utilities =
        'bg|text|border|ring|ring-offset|fill|stroke|from|via|to|outline|divide|decoration|accent|caret|shadow|placeholder';
    const patterns = [
        // Valor arbitrário com cor literal: bg-[#a6e86b], text-[rgb(0,0,0)].
        String.raw`\[[^\]]*(#[0-9a-fA-F]{3}|rgba?\(|hsla?\(|oklch\()`,
        // Utilitário de paleta: text-green-600, bg-black, border-white/50.
        String.raw`(^|[\s:!"'` +
            '`' +
            String.raw`])(${utilities})-((${palette})-[0-9]{2,3}|black|white)($|[\s/"'` +
            '`' +
            String.raw`])`,
        // Variável de marca, que não é semântica.
        '--ft-marca-',
    ];
    const message =
        'Cor literal, paleta do Tailwind e --ft-marca-* são proibidos em src/: use só utilitários e variáveis semânticos do tema (spec 0004, INV-0004-02).';
    return patterns.flatMap((pattern) => [
        { selector: `Literal[value=/${pattern}/]`, message },
        { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
    ]);
}
