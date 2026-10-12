import js from '@eslint/js';
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
    prettierConfig,
);
