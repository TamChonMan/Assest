'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Currency = 'USD' | 'HKD' | 'TWD' | 'JPY' | 'EUR' | 'GBP' | 'CNY' | 'MOP';

// All rates relative to 1 USD (i.e., "how many X per 1 USD")
const EXCHANGE_RATES: Record<string, number> = {
    USD: 1,
    HKD: 7.8,
    MOP: 8.03,
    TWD: 32.5,
    JPY: 149.5,
    EUR: 0.92,
    GBP: 0.79,
    CNY: 7.25,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    HKD: 'HK$',
    MOP: 'MOP$',
    TWD: 'NT$',
    JPY: '¥',
    EUR: '€',
    GBP: '£',
    CNY: '¥',
};

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (c: Currency) => void;
    /** Convert amount from USD to selected currency */
    convert: (amountInUSD: number) => number;
    /** Format amount assumed to be in USD → selected currency */
    format: (amountInUSD: number) => string;
    /** Convert amount from sourceCurrency to selected currency */
    convertFrom: (amount: number, fromCurrency: string) => number;
    /** Format amount from sourceCurrency → selected currency */
    formatFrom: (amount: number, fromCurrency: string) => string;
    symbol: string;
    currencies: Currency[];
}

const CurrencyContext = createContext<CurrencyContextType>({
    currency: 'USD',
    setCurrency: () => { },
    convert: (v) => v,
    format: (v) => `$${v.toFixed(2)}`,
    convertFrom: (v) => v,
    formatFrom: (v) => `$${v.toFixed(2)}`,
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
        return `${CURRENCY_SYMBOLS[currency] || currency}${converted.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    /**
     * Convert from any source currency to the selected settlement currency.
     * Path: sourceCurrency → USD → selectedCurrency
     */
    const convertFrom = (amount: number, fromCurrency: string): number => {
        const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
        const toRate = EXCHANGE_RATES[currency];
        // amount in source → USD → target
        return (amount / fromRate) * toRate;
    };

    const formatFrom = (amount: number, fromCurrency: string): string => {
        const converted = convertFrom(amount, fromCurrency);
        return `${CURRENCY_SYMBOLS[currency] || currency}${converted.toLocaleString(undefined, {
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
                convertFrom,
                formatFrom,
                symbol: CURRENCY_SYMBOLS[currency] || currency,
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
