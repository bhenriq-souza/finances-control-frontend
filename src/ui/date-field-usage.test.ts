import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Varredura de `src/` (AC-0009-14, INV-0009-07): nenhum `<input type="date">` nativo resta, e o
// código do calendário só entra pelo import dinâmico do `DateField`.

const SRC = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

const files = sourceFiles(SRC).map((path) => ({
    path: relative(SRC, path),
    text: readFileSync(path, 'utf8'),
}));

describe('DateField usage (AC-0009-14, INV-0009-07)', () => {
    it('leaves no native date input in src/', () => {
        const nativeDate = /type\s*[=:]\s*\{?\s*["'`]date["'`]/;
        expect(files.filter(({ text }) => nativeDate.test(text)).map(({ path }) => path)).toEqual(
            [],
        );
    });

    it('imports react-day-picker and date-fns only inside src/ui/calendar/', () => {
        const calendarLibrary = /from\s+["'](react-day-picker|date-fns|@date-fns)/;
        const offenders = files
            .filter(({ path }) => !path.startsWith(join('ui', 'calendar')))
            .filter(({ text }) => calendarLibrary.test(text))
            .map(({ path }) => path);
        expect(offenders).toEqual([]);
    });

    it('reaches the calendar only through a dynamic import', () => {
        const staticCalendarImport = /from\s+["'][^"']*\/calendar\//;
        const offenders = files
            .filter(({ path }) => !path.startsWith(join('ui', 'calendar')))
            .filter(({ text }) => staticCalendarImport.test(text))
            .map(({ path }) => path);
        expect(offenders).toEqual([]);
        const dateField = files.find(({ path }) => path === join('ui', 'date-field.tsx'));
        expect(dateField?.text).toMatch(
            /import\(\s*["']\.\/calendar\/date-picker-surface["']\s*\)/,
        );
    });
});
