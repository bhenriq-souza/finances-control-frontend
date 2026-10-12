import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusBadge } from './status-badge';
import {
    bankTransferBadge,
    DERIVED_BADGES,
    earningBadge,
    expenseBadge,
    statementBadge,
    type Badge,
    type BadgeFamily,
} from './status-labels';

const FAMILY_CLASSES: Record<BadgeFamily, string[]> = {
    positivo: ['bg-positivo-fundo', 'text-positivo'],
    negativo: ['bg-negativo-fundo', 'text-negativo'],
    atencao: ['bg-atencao-fundo', 'text-atencao'],
    info: ['bg-info-fundo', 'text-info'],
    neutra: ['bg-superficie-elevada', 'text-texto-apoio'],
};

function renderBadge(badge: Badge) {
    render(<StatusBadge badge={badge} />);
    return screen.getByText(badge.label);
}

function expectBadge(badge: Badge, label: string, family: BadgeFamily) {
    const el = renderBadge(badge);
    expect(el).toHaveTextContent(label);
    expect(el).toHaveAttribute('data-family', family);
    expect(el).toHaveClass(...FAMILY_CLASSES[family], 'uppercase', 'h-6', 'text-rotulo');
}

const TODAY = '2026-10-15';
const OTHER_DAY = '2026-10-20';

// A tabela da spec 0009 ("Status — StatusBadge"), linha a linha (AC-0009-04, INV-0009-04).
describe('StatusBadge — status table', () => {
    it.each([
        ['OPEN', 'Pendente', 'neutra'],
        ['FORECAST', 'Previsto', 'info'],
        ['PAID', 'Pago', 'positivo'],
        ['OVERDUE', 'Vencido', 'negativo'],
        ['VERIFYING', 'Verificando', 'neutra'],
    ] as const)('despesa %s → %s (%s)', (status, label, family) => {
        expectBadge(
            expenseBadge({ status, occurredOn: OTHER_DAY, bankAccountId: 'acc' }, TODAY),
            label,
            family,
        );
    });

    it.each([
        ['OPEN', 'Pendente', 'neutra'],
        ['FORECAST', 'Previsto', 'info'],
        ['RECEIVED', 'Recebido', 'positivo'],
        ['OVERDUE', 'Atrasado', 'negativo'],
        ['VERIFYING', 'Verificando', 'neutra'],
    ] as const)('receita %s → %s (%s)', (status, label, family) => {
        expectBadge(earningBadge({ status }), label, family);
    });

    it.each([
        ['OPEN', false, 'Em aberto', 'info'],
        ['CLOSED', false, 'Fechada', 'atencao'],
        ['CLOSED', true, 'Vencida', 'negativo'],
        ['PAID', false, 'Paga', 'positivo'],
        ['ROLLED_OVER', false, 'Rolada', 'neutra'],
    ] as const)('fatura %s overdue=%s → %s (%s)', (status, overdue, label, family) => {
        expectBadge(statementBadge({ status, overdue, dueOn: OTHER_DAY }, TODAY), label, family);
    });

    it.each([
        ['SCHEDULED', 'Agendada', 'info'],
        ['COMPLETED', 'Concluída', 'positivo'],
    ] as const)('transferência %s → %s (%s)', (status, label, family) => {
        expectBadge(bankTransferBadge({ status }), label, family);
    });
});

describe('StatusBadge — derived badges', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('Vence hoje for an account expense OPEN on today()', () => {
        expectBadge(
            expenseBadge({ status: 'OPEN', occurredOn: TODAY, bankAccountId: 'acc' }, TODAY),
            'Vence hoje',
            'atencao',
        );
    });

    it('not Vence hoje for a card expense, or an account expense in another status', () => {
        expect(
            expenseBadge({ status: 'OPEN', occurredOn: TODAY, bankAccountId: null }, TODAY),
        ).toEqual({ label: 'Pendente', family: 'neutra' });
        expect(
            expenseBadge({ status: 'PAID', occurredOn: TODAY, bankAccountId: 'acc' }, TODAY),
        ).toEqual({ label: 'Pago', family: 'positivo' });
    });

    it('Vence hoje for a CLOSED statement due today(), unless it is overdue', () => {
        expectBadge(
            statementBadge({ status: 'CLOSED', overdue: false, dueOn: TODAY }, TODAY),
            'Vence hoje',
            'atencao',
        );
        expect(statementBadge({ status: 'PAID', overdue: false, dueOn: TODAY }, TODAY)).toEqual({
            label: 'Paga',
            family: 'positivo',
        });
    });

    it('uses today() in São Paulo when no reference is given', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-16T02:30:00Z'));
        expect(
            expenseBadge({ status: 'OPEN', occurredOn: TODAY, bankAccountId: 'acc' }).label,
        ).toBe('Vence hoje');
        expect(statementBadge({ status: 'CLOSED', overdue: false, dueOn: TODAY }).label).toBe(
            'Vence hoje',
        );
    });

    it.each([
        [DERIVED_BADGES.arquivado, 'Arquivado', 'neutra'],
        [DERIVED_BADGES.aguardando, 'Aguardando', 'atencao'],
    ] as const)('%o', (badge, label, family) => {
        expectBadge(badge, label, family);
    });
});

describe('StatusBadge — rendering', () => {
    it('shows a decorative dot and the label as text, so colour is never the only cue', () => {
        const el = renderBadge(DERIVED_BADGES.venceHoje);
        const dot = el.querySelector('[aria-hidden="true"]');
        expect(dot).toHaveClass('bg-atencao', 'rounded-full');
        expect(el.textContent).toBe('Vence hoje');
    });

    it('merges an extra className', () => {
        render(<StatusBadge badge={DERIVED_BADGES.arquivado} className="ml-2" />);
        expect(screen.getByText('Arquivado')).toHaveClass('ml-2', 'bg-superficie-elevada');
    });
});
