// Fixture do orquestrador (scripts/check.mjs): monta um repositório descartável com uma cópia do
// script e ferramentas falsas, e o executa como processo. O orquestrador resolve ROOT a partir do
// próprio caminho (`scripts/..`), então a cópia enxerga só o fixture. O PATH do processo contém
// apenas um diretório de binários falsos: nenhum Docker, rede, npm ou Playwright reais.

import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const REAL_SCRIPT = resolve(import.meta.dirname, 'check.mjs');

/** Gates na ordem da spec 0002. */
export const GATE_ORDER = [
    'contract',
    'format',
    'lint',
    'types',
    'boundaries',
    'test',
    'audit',
    'specs',
    'sast',
    'build',
    'e2e',
];

/** Gates de ferramenta npm: pacotes que o orquestrador confere e binário que o `npx` executa. */
const TOOLS = {
    format: { bin: 'prettier', packages: ['prettier'] },
    lint: { bin: 'eslint', packages: ['eslint'] },
    types: { bin: 'tsc', packages: ['typescript'] },
    boundaries: { bin: 'depcruise', packages: ['dependency-cruiser'] },
    test: { bin: 'vitest', packages: ['vitest', '@vitest/coverage-v8'] },
    e2e: { bin: 'playwright', packages: ['@playwright/test'] },
};

/** Gates que executam um script do repositório. */
const SCRIPTS = {
    contract: 'scripts/contract.mjs',
    specs: 'scripts/check-specs.mjs',
    sast: 'scripts/sast.mjs',
    build: 'scripts/build.mjs',
};

/**
 * Opções (tudo presente e verde por padrão):
 * - failing: gates cuja execução sai com 1;
 * - undeclared / notInstalled: pacotes (nomes) fora do package.json / do node_modules;
 * - missing: arquivos ou pastas relativos a não criar;
 * - noManifest: sem package.json;
 * - hostTools: ferramentas externas no PATH (`docker`, `semgrep`);
 * - chromium: o Chromium do Playwright existe;
 * - noNpx: o PATH não tem `npx`.
 */
export function runCheck(options = {}, args = []) {
    const {
        failing = [],
        undeclared = [],
        notInstalled = [],
        missing = [],
        noManifest = false,
        hostTools = [],
        chromium = true,
        noNpx = false,
    } = options;
    const root = mkdtempSync(join(tmpdir(), 'check-fixture-'));
    try {
        const has = (path) => !missing.includes(path);
        const exitOf = (gate) => (failing.includes(gate) ? 1 : 0);
        const write = (path, content, mode) => {
            const file = join(root, path);
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, content);
            if (mode) chmodSync(file, mode);
        };

        mkdirSync(join(root, 'scripts'));
        copyFileSync(REAL_SCRIPT, join(root, 'scripts', 'check.mjs'));

        // Manifesto e node_modules.
        const packages = [...Object.values(TOOLS).flatMap((tool) => tool.packages), 'vite'];
        if (!noManifest) {
            const devDependencies = Object.fromEntries(
                packages.filter((p) => !undeclared.includes(p)).map((p) => [p, '*']),
            );
            write('package.json', JSON.stringify({ name: 'fixture', devDependencies }));
        }
        for (const pkg of packages) {
            if (!notInstalled.includes(pkg)) {
                mkdirSync(join(root, 'node_modules', pkg), { recursive: true });
            }
        }

        // Binários locais que o `npx` falso executa.
        for (const [gate, { bin }] of Object.entries(TOOLS)) {
            write(
                `node_modules/.bin/${bin}`,
                `#!/bin/sh\necho "fake ${bin} executado"\nexit ${exitOf(gate)}\n`,
                0o755,
            );
        }

        // Scripts de gate e arquivos que os gates conferem.
        for (const [gate, path] of Object.entries(SCRIPTS)) {
            if (has(path)) {
                write(
                    path,
                    `console.log('fake ${gate} executado');\nprocess.exit(${exitOf(gate)});\n`,
                );
            }
        }
        if (has('sources.json')) write('sources.json', '{}');
        if (has('tsconfig.json')) write('tsconfig.json', '{}');
        if (has('.dependency-cruiser.cjs')) write('.dependency-cruiser.cjs', '');
        if (has('src')) mkdirSync(join(root, 'src'));
        if (has('e2e')) mkdirSync(join(root, 'e2e'));
        if (has('package-lock.json')) write('package-lock.json', '{}');

        // Playwright falso: só informa onde estaria o Chromium.
        const chromiumPath = join(root, 'chromium-bin');
        if (chromium) write('chromium-bin', '');
        write(
            'node_modules/@playwright/test/index.js',
            `exports.chromium = { executablePath: () => ${JSON.stringify(chromiumPath)} };\n`,
        );

        // PATH isolado: node real, `npx`/`npm` falsos e as ferramentas externas pedidas.
        const bin = join(root, 'path-bin');
        mkdirSync(bin);
        symlinkSync(process.execPath, join(bin, 'node'));
        if (!noNpx) {
            write(
                'path-bin/npx',
                '#!/bin/sh\ntool="$1"\nshift\nexec "node_modules/.bin/$tool" "$@"\n',
                0o755,
            );
        }
        write(
            'path-bin/npm',
            `#!/bin/sh\necho "fake npm executado"\nexit ${exitOf('audit')}\n`,
            0o755,
        );
        for (const tool of hostTools) {
            write(`path-bin/${tool}`, '#!/bin/sh\nexit 0\n', 0o755);
        }

        const result = spawnSync(process.execPath, [join(root, 'scripts', 'check.mjs'), ...args], {
            cwd: root,
            encoding: 'utf8',
            timeout: 60_000,
            env: { PATH: bin },
        });
        return {
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
            table: parseTable(result.stdout),
        };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/** Linhas da tabela "Resumo", por gate, na ordem impressa. */
function parseTable(stdout) {
    const table = {};
    const summary = stdout.split('\nResumo\n')[1] ?? '';
    for (const line of summary.split('\n')) {
        const match = /^ {2}(\w+)\s+(PASS|FAIL|SKIP)(?: {2}— (.*))?$/.exec(line);
        if (match) table[match[1]] = { status: match[2], reason: match[3] ?? '' };
    }
    return table;
}
