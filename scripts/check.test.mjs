import { describe, expect, it } from 'vitest';

import { GATE_ORDER, runCheck } from './check-fixture.mjs';

// Spec 0002: orquestrador único (scripts/check.mjs), exercitado como processo contra um
// repositório descartável com ferramentas falsas (ver check-fixture.mjs).

const pass = { status: 'PASS', reason: '' };
const fail = { status: 'FAIL', reason: 'código de saída 1' };
const allPassExcept = (...except) =>
    Object.fromEntries(GATE_ORDER.filter((g) => !except.includes(g)).map((g) => [g, pass]));

describe('scripts/check.mjs', () => {
    describe('AC-0002-01 / INV-0002-01: executa os gates e imprime a tabela final', () => {
        it('lista todos os gates da spec, na ordem, e PASS/SKIP com motivo', () => {
            const run = runCheck({ hostTools: ['docker'] });

            expect(Object.keys(run.table)).toEqual(GATE_ORDER);
            expect(run.table).toEqual(allPassExcept());
            expect(run.stdout).toContain('Tudo verde (11 executados, 0 pulados).');
        });

        it('executa de fato cada ferramenta disponível', () => {
            const { stdout } = runCheck({ hostTools: ['docker'] });

            for (const tool of [
                'contract',
                'prettier',
                'eslint',
                'tsc',
                'depcruise',
                'vitest',
                'npm',
                'specs',
                'sast',
                'build',
                'playwright',
            ]) {
                expect(stdout).toContain(`fake ${tool} executado`);
            }
        });

        it('imprime o cabeçalho de cada gate e o motivo do SKIP no trecho do próprio gate', () => {
            const { stdout } = runCheck({ missing: ['e2e'] });

            for (const gate of GATE_ORDER) expect(stdout).toContain(`──────── ${gate} ────────`);
            expect(stdout).toContain('SKIP: e2e ainda não existe neste repositório');
        });
    });

    describe('AC-0002-02: código de saída', () => {
        it('sai com 0 quando nenhum gate falha', () => {
            expect(runCheck({ hostTools: ['docker'] }).status).toBe(0);
        });

        it('sai com 1 quando um gate falha, com o motivo na tabela e o gate em "Bloqueando"', () => {
            const run = runCheck({ failing: ['lint'] });

            expect(run.status).toBe(1);
            expect(run.table.lint).toEqual(fail);
            expect(run.stderr).toContain('Bloqueando: lint');
        });

        it('executa os gates seguintes depois de uma falha e lista todas as falhas', () => {
            const run = runCheck({ failing: ['format', 'specs'], hostTools: ['docker'] });

            expect(run.status).toBe(1);
            expect(run.table).toEqual({
                ...allPassExcept('format', 'specs'),
                format: fail,
                specs: fail,
            });
            expect(Object.keys(run.table)).toEqual(GATE_ORDER);
            expect(run.stdout).toContain('fake playwright executado');
            expect(run.stderr).toContain('Bloqueando: format, specs');
        });

        it('ferramenta que não executa (ENOENT) é FAIL, nunca SKIP', () => {
            const run = runCheck({ noNpx: true });

            expect(run.status).toBe(1);
            expect(run.table.format.status).toBe('FAIL');
            expect(run.table.format.reason).toContain('ENOENT');
        });

        it('SKIP não afeta o código de saída no modo normal (ERR-0002-01)', () => {
            const run = runCheck({ missing: ['tsconfig.json'], hostTools: ['docker'] });

            expect(run.status).toBe(0);
            expect(run.table.types.status).toBe('SKIP');
            expect(run.stdout).toContain('Tudo verde (10 executados, 1 pulados).');
        });
    });

    describe('INV-0002-02: gate ausente é SKIP com motivo, nunca PASS', () => {
        it('SKIP com o motivo de cada causa, sem executar a ferramenta', () => {
            const run = runCheck({
                undeclared: ['prettier'],
                notInstalled: ['eslint'],
                missing: ['tsconfig.json', '.dependency-cruiser.cjs', 'package-lock.json'],
            });

            expect(run.table.format).toEqual({
                status: 'SKIP',
                reason: 'prettier não está declarado no package.json',
            });
            expect(run.table.lint).toEqual({
                status: 'SKIP',
                reason: 'eslint declarado mas não instalado (rode npm ci)',
            });
            expect(run.table.types).toEqual({
                status: 'SKIP',
                reason: 'tsconfig.json ainda não existe neste repositório',
            });
            expect(run.table.boundaries).toEqual({
                status: 'SKIP',
                reason: '.dependency-cruiser.cjs ainda não existe neste repositório',
            });
            expect(run.table.audit).toEqual({
                status: 'SKIP',
                reason: 'package-lock.json ainda não existe neste repositório',
            });
            expect(run.stdout).not.toContain('fake prettier');
            expect(run.stdout).not.toContain('fake eslint');
            expect(run.stdout).not.toContain('fake npm');
        });

        it('sem package.json, os gates de ferramenta são SKIP (contexto)', () => {
            const run = runCheck({ noManifest: true });

            for (const gate of ['format', 'lint', 'test', 'build', 'e2e']) {
                expect(run.table[gate]).toEqual({
                    status: 'SKIP',
                    reason: expect.stringContaining('package.json ainda não existe'),
                });
            }
        });

        it('script de gate inexistente é SKIP (contexto) citando o caminho (ERR-0002-04)', () => {
            const run = runCheck({ missing: ['scripts/check-specs.mjs'] });

            expect(run.table.specs).toEqual({
                status: 'SKIP',
                reason: 'scripts/check-specs.mjs ainda não existe neste repositório',
            });
        });
    });

    describe('AC-0002-03 / INV-0002-05: --require-tools converte todo SKIP em falha', () => {
        it('sai com 1 se qualquer gate for pulado, e explica no modo estrito', () => {
            const run = runCheck({ missing: ['tsconfig.json'], hostTools: ['docker'] }, [
                '--require-tools',
            ]);

            expect(run.status).toBe(1);
            expect(run.table.types.status).toBe('SKIP');
            expect(run.stdout).toContain('modo estrito: SKIP conta como falha');
            expect(run.stderr).toContain('Modo estrito: 1 gate(s) pulado(s)');
            expect(run.stderr).toContain('Bloqueando: types');
        });

        it('trata como falha cada SKIP (contexto e ambiente) e cada FAIL, juntos', () => {
            const run = runCheck(
                { failing: ['lint'], missing: ['sources.json'], chromium: false },
                ['--require-tools'],
            );

            expect(run.status).toBe(1);
            expect(run.stderr).toContain('Bloqueando: lint, contract, sast, e2e');
        });

        it('sai com 0 quando nenhum gate é pulado nem falha', () => {
            const run = runCheck({ hostTools: ['docker'] }, ['--require-tools']);

            expect(run.status).toBe(0);
            expect(run.stderr).toBe('');
            expect(run.stdout).toContain('Tudo verde (11 executados, 0 pulados).');
        });

        it('um FAIL continua falha no modo estrito, sem a mensagem de SKIP', () => {
            const run = runCheck({ failing: ['test'], hostTools: ['docker'] }, ['--require-tools']);

            expect(run.status).toBe(1);
            expect(run.stderr).not.toContain('pulado(s)');
            expect(run.stderr).toContain('Bloqueando: test');
        });
    });

    describe('AC-0002-05 / INV-0002-06: disponibilidade do gate sast', () => {
        it('sem docker nem semgrep no PATH, é SKIP (ambiente) citando as duas ferramentas', () => {
            const run = runCheck();

            expect(run.table.sast).toEqual({
                status: 'SKIP',
                reason: 'nenhuma destas ferramentas está instalada: docker, semgrep',
            });
            expect(run.stdout).not.toContain('fake sast');
            expect(run.status).toBe(0);
        });

        it('sem docker nem semgrep, --require-tools o torna falha (ERR-0002-05)', () => {
            const run = runCheck({}, ['--require-tools']);

            expect(run.status).toBe(1);
            expect(run.stderr).toContain('Bloqueando: sast');
        });

        it.each(['docker', 'semgrep'])('com apenas %s no PATH, o gate roda', (tool) => {
            const run = runCheck({ hostTools: [tool] });

            expect(run.table.sast).toEqual(pass);
            expect(run.stdout).toContain('fake sast executado');
        });

        it('sem scripts/sast.mjs é SKIP (contexto), mesmo com docker no PATH', () => {
            const run = runCheck({ hostTools: ['docker'], missing: ['scripts/sast.mjs'] });

            expect(run.table.sast).toEqual({
                status: 'SKIP',
                reason: 'scripts/sast.mjs ainda não existe neste repositório',
            });
        });

        it('um achado do SAST (saída 1 do script) é FAIL, nunca SKIP (ERR-0002-06)', () => {
            const run = runCheck({ hostTools: ['docker'], failing: ['sast'] });

            expect(run.status).toBe(1);
            expect(run.table.sast).toEqual(fail);
        });
    });

    describe('disponibilidade do gate contract', () => {
        it('sem scripts/contract.mjs é SKIP (contexto)', () => {
            const run = runCheck({ missing: ['scripts/contract.mjs'] });

            expect(run.table.contract).toEqual({
                status: 'SKIP',
                reason: 'scripts/contract.mjs ainda não existe neste repositório',
            });
        });

        it('sem sources.json é SKIP (contexto)', () => {
            const run = runCheck({ missing: ['sources.json'] });

            expect(run.table.contract).toEqual({
                status: 'SKIP',
                reason: 'sources.json ainda não existe neste repositório',
            });
            expect(run.stdout).not.toContain('fake contract');
        });

        it('com os dois presentes roda, e a falha do script é FAIL', () => {
            const run = runCheck({ failing: ['contract'] });

            expect(run.table.contract).toEqual(fail);
            expect(run.stdout).toContain('fake contract executado');
        });
    });

    describe('disponibilidade do gate build', () => {
        it('com vite declarado e instalado, roda scripts/build.mjs', () => {
            const run = runCheck();

            expect(run.table.build).toEqual(pass);
            expect(run.stdout).toContain('fake build executado');
        });

        it('sem vite no package.json é SKIP (contexto)', () => {
            const run = runCheck({ undeclared: ['vite'] });

            expect(run.table.build).toEqual({
                status: 'SKIP',
                reason: 'vite não está declarado no package.json',
            });
        });

        it('com vite declarado e não instalado é SKIP (ambiente)', () => {
            const run = runCheck({ notInstalled: ['vite'] });

            expect(run.table.build).toEqual({
                status: 'SKIP',
                reason: 'vite declarado mas não instalado (rode npm ci)',
            });
        });

        it('a falha do script é FAIL', () => {
            expect(runCheck({ failing: ['build'] }).table.build).toEqual(fail);
        });
    });

    describe('disponibilidade do gate e2e', () => {
        it('sem @playwright/test no package.json é SKIP (contexto)', () => {
            const run = runCheck({ undeclared: ['@playwright/test'] });

            expect(run.table.e2e).toEqual({
                status: 'SKIP',
                reason: '@playwright/test não está declarado no package.json',
            });
        });

        it('sem a pasta e2e/ é SKIP (contexto)', () => {
            const run = runCheck({ missing: ['e2e'] });

            expect(run.table.e2e).toEqual({
                status: 'SKIP',
                reason: 'e2e ainda não existe neste repositório',
            });
        });

        it('sem o Chromium é SKIP (ambiente) citando o comando de instalação (ERR-0002-11)', () => {
            const run = runCheck({ chromium: false });

            expect(run.table.e2e).toEqual({
                status: 'SKIP',
                reason: 'Chromium do Playwright não instalado (rode npx playwright install chromium)',
            });
            expect(run.stdout).not.toContain('fake playwright');
        });

        it('sem o Chromium, --require-tools o torna falha', () => {
            const run = runCheck({ chromium: false, hostTools: ['docker'] }, ['--require-tools']);

            expect(run.status).toBe(1);
            expect(run.stderr).toContain('Bloqueando: e2e');
        });

        it('com tudo presente roda, e a falha do Playwright é FAIL', () => {
            expect(runCheck().table.e2e).toEqual(pass);
            expect(runCheck({ failing: ['e2e'] }).table.e2e).toEqual(fail);
        });
    });
});
