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
    prettierConfig,
);
