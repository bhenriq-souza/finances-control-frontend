import { useSyncExternalStore } from 'react';

import { useTheme } from '@/ui/theme/theme-provider';

import logoFundoClaro from './farmtech-logo-horizontal-fundo-claro.svg';
import logoFundoEscuro from './farmtech-logo-horizontal-fundo-escuro.svg';
import simboloFundoClaro from './farmtech-simbolo-compacto-fundo-claro.svg';
import simboloFundoEscuro from './farmtech-simbolo-compacto-fundo-escuro.svg';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

function subscribe(onChange: () => void): () => void {
    const query = window.matchMedia?.(LIGHT_QUERY);
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
}

/** Sem `matchMedia`, vale o padrão do tema: escuro (tokens.css). */
const systemIsLight = () => window.matchMedia?.(LIGHT_QUERY).matches ?? false;

/** Fundo efetivo: a escolha do usuário, ou o esquema do sistema em `sistema` (spec 0004). */
export function useFundoClaro(): boolean {
    const { tema } = useTheme();
    const light = useSyncExternalStore(subscribe, systemIsLight);
    return tema === 'claro' || (tema === 'sistema' && light);
}

interface BrandProps {
    className?: string;
}

/** Logo horizontal da FarmTech, na versão do fundo do tema (nunca recolorido). */
export function BrandLogo({ className }: BrandProps) {
    const claro = useFundoClaro();
    return (
        <img src={claro ? logoFundoClaro : logoFundoEscuro} alt="FarmTech" className={className} />
    );
}

/** Símbolo compacto da FarmTech (de 24 a 48px), na versão do fundo do tema. */
export function BrandSymbol({ className }: BrandProps) {
    const claro = useFundoClaro();
    return (
        <img
            src={claro ? simboloFundoClaro : simboloFundoEscuro}
            alt="FarmTech"
            className={className}
        />
    );
}
