'use client';

import { ReactNode } from 'react';
import { I18nProvider } from '@/context/I18nContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

export default function AppProviders({ children }: { children: ReactNode }) {
    return (
        <I18nProvider>
            <CurrencyProvider>
                {children}
            </CurrencyProvider>
        </I18nProvider>
    );
}
