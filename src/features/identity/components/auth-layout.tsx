import type { ReactNode } from 'react';

import { BrandLogo } from '@/ui/brand/brand';
import { Card, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card';

interface AuthLayoutProps {
    title: string;
    description?: ReactNode;
    children: ReactNode;
}

/** Moldura das telas de autenticação e de estado da conta: logo, título e um cartão. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
    return (
        <main className="flex min-h-dvh flex-col items-center bg-fundo px-4 py-8 text-texto md:justify-center md:py-12">
            <div className="flex w-full max-w-md flex-col gap-6">
                <BrandLogo className="h-8 self-center md:h-10" />
                <Card className="p-5 md:p-8">
                    <CardHeader>
                        <CardTitle>{title}</CardTitle>
                        {description && <CardDescription>{description}</CardDescription>}
                    </CardHeader>
                    {children}
                </Card>
            </div>
        </main>
    );
}
