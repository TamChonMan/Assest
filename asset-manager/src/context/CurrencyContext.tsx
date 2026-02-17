'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Currency = 'USD' | 'HKD' | 'TWD' | 'JPY' | 'EUR' | 'GBP' | 'CNY';

// Approximate exchange rates relative to USD
const EXCHANGE_RATES: Record<Currency, number> = {
    USD: 1,
    HKD: 7.8,
    TWD: 32.5,
    JPY: 149.5,
    EUR: 0.92,
    GBP: 0.79,
    CNY: 7.25,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: '$',
    HKD: 'HK$',
    TWD: 'NT$',
    JPY: '¥',
    EUR: '€',
    GBP: '£',
    CNY: '¥',
};

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (c: Currency) => void;
    convert: (amountInUSD: number) => number;
    format: (amountInUSD: number) => string;
    symbol: string;
    currencies: Currency[];
}

const CurrencyContext = createContext<CurrencyContextType>({
    currency: 'USD',
    setCurrency: () => { },
    convert: (v) => v,
    format: (v) => `$${v.toFixed(2)}`,
    symbol: '$',
    currencies: [],
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrency] = useState<Currency>('USD');

    const convert = (amountInUSD: number): number => {
        return amountInUSD * EXCHANGE_RATES[currency];
    };

    const format = (amountInUSD: number): string => {
        const converted = convert(amountInUSD);
        return `${CURRENCY_SYMBOLS[currency]}${converted.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    return (
        <CurrencyContext.Provider
            value={{
                currency,
                setCurrency,
                convert,
                format,
                symbol: CURRENCY_SYMBOLS[currency],
                currencies: Object.keys(EXCHANGE_RATES) as Currency[],
            }}
        >
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    return useContext(CurrencyContext);
}
