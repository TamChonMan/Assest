'use client';

import { useState } from 'react';
import { Sparkles, Globe, Coins, History, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/context/I18nContext';
import { useCurrency, Currency } from '@/context/CurrencyContext';

export default function SettingsPage() {
    const { locale, setLocale, t } = useI18n();
    const { currency, setCurrency, currencies } = useCurrency();

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Header */}
            <header>
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Preferences</span>
                </div>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('settings.title')}</h1>
                <p className="text-zinc-500 mt-1 text-sm">{t('settings.subtitle')}</p>
            </header>

            {/* Language Card */}
            <div className="card">
                <div className="flex items-center gap-3 mb-4">
                    <div className="icon-badge bg-indigo-50">
                        <Globe size={18} className="text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-zinc-900">{t('settings.language')}</h2>
                        <p className="text-xs text-zinc-500">{t('settings.language_desc')}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setLocale('en')}
                        className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border
                            ${locale === 'en'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                            }`}
                    >
                        🇬🇧 English
                    </button>
                    <button
                        onClick={() => setLocale('zh')}
                        className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border
                            ${locale === 'zh'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                            }`}
                    >
                        🇨🇳 中文
                    </button>
                </div>
            </div>

            {/* Currency Card */}
            <div className="card">
                <div className="flex items-center gap-3 mb-4">
                    <div className="icon-badge bg-violet-50">
                        <Coins size={18} className="text-violet-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-zinc-900">{t('settings.currency')}</h2>
                        <p className="text-xs text-zinc-500">{t('settings.currency_desc')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {currencies.map((c) => (
                        <button
                            key={c}
                            onClick={() => setCurrency(c as Currency)}
                            className={`px-3 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border
                                ${currency === c
                                    ? 'bg-violet-50 text-violet-600 border-violet-200 shadow-sm'
                                    : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Data Management Card */}
            <DataManagementCard />
        </div>
    );
}

function DataManagementCard() {
    const { t } = useI18n();
    const [startDate, setStartDate] = useState('2020-01-01');
    const [rebuilding, setRebuilding] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleRebuild = async () => {
        setRebuilding(true);
        setResult(null);
        try {
            await api.post(`/analytics/rebuild-history?start_date=${startDate}`);
            setResult('✅ History rebuilt successfully!');
        } catch (err: any) {
            setResult(`❌ Error: ${err.message}`);
        } finally {
            setRebuilding(false);
        }
    };

    return (
        <div className="card">
            <div className="flex items-center gap-3 mb-4">
                <div className="icon-badge bg-amber-50">
                    <History size={18} className="text-amber-500" />
                </div>
                <div>
                    <h2 className="font-bold text-zinc-900">{t('settings.data_mgmt') || 'Data Management'}</h2>
                    <p className="text-xs text-zinc-500">{t('settings.data_mgmt_desc') || 'Rebuild portfolio history from past transactions'}</p>
                </div>
            </div>
            <div className="space-y-3">
                <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">{t('settings.start_date') || 'Start Date'}</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-field w-full"
                    />
                </div>
                <button
                    onClick={handleRebuild}
                    disabled={rebuilding}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {rebuilding ? (
                        <><RefreshCw size={14} className="animate-spin" /> {t('settings.rebuilding') || 'Rebuilding...'}</>
                    ) : (
                        <><RefreshCw size={14} /> {t('settings.rebuild_history') || 'Rebuild Portfolio History'}</>
                    )}
                </button>
                {result && (
                    <p className={`text-sm font-medium ${result.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}`}>
                        {result}
                    </p>
                )}
            </div>
        </div>
    );
}
