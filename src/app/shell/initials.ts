/** Iniciais do avatar: primeira e última palavra do nome; sem nome, a primeira letra do email. */
export function initials(name: string, email: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return email.trim().charAt(0).toUpperCase();
    const first = words[0]?.charAt(0) ?? '';
    const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
    return (first + last).toUpperCase();
}
