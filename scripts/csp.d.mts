export const CSP_ENFORCE: boolean;
export const NGINX_NONCE: string;
export function buildCsp(
    html: string,
    mode?: 'enforce' | 'report-only',
    nonce?: string,
): { header: string; value: string };
