'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, Activity, PieChart, Settings, Globe, ChevronDown } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency, Currency } from '@/context/CurrencyContext';

export default function Sidebar() {
    const pathname = usePathname();
    const { locale, setLocale, t } = useI18n();
    const { currency, setCurrency, currencies } = useCurrency();

    const navItems = [
        { href: '/', labelKey: 'nav.dashboard', icon: Home, color: 'text-blue-400' },
        { href: '/accounts', labelKey: 'nav.accounts', icon: Wallet, color: 'text-emerald-400' },
        { href: '/transactions', labelKey: 'nav.transactions', icon: Activity, color: 'text-purple-400' },
        { href: '/analytics', labelKey: 'nav.analytics', icon: PieChart, color: 'text-amber-400' },
    ];

    return (
        <aside
            className="h-screen w-64 fixed left-0 top-0 z-50 flex flex-col"
            style={{ backgroundColor: 'var(--color-sidebar-bg)' }}
        >
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {t('app.title')}
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--color-sidebar-text)' }}>
                    {t('app.subtitle')}
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-smooth group
                ${isActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <Icon
                                size={20}
                                className={`transition-smooth ${isActive ? item.color : 'group-hover:' + item.color}`}
                            />
                            <span className="font-medium text-sm">{t(item.labelKey)}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Language & Currency Selectors */}
            <div className="px-3 pb-2 space-y-2">
                {/* Language Toggle */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
                    <Globe size={16} className="text-slate-400" />
                    <div className="flex flex-1 rounded-md overflow-hidden border border-white/10">
                        <button
                            onClick={() => setLocale('en')}
                            className={`flex-1 text-xs py-1.5 font-medium transition-smooth cursor-pointer ${locale === 'en'
                                    ? 'bg-blue-500/30 text-blue-300'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLocale('zh')}
                            className={`flex-1 text-xs py-1.5 font-medium transition-smooth cursor-pointer ${locale === 'zh'
                                    ? 'bg-blue-500/30 text-blue-300'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            中文
                        </button>
                    </div>
                </div>

                {/* Currency Selector */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
                    <ChevronDown size={16} className="text-slate-400" />
                    <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className="flex-1 bg-transparent border border-white/10 rounded-md text-xs text-slate-300 py-1.5 px-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none"
                    >
                        {currencies.map((c) => (
                            <option key={c} value={c} className="bg-slate-800 text-white">{c}</option>
                        ))}
                    </select>
                    <span className="text-xs text-slate-500">{t('currency.settlement')}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-smooth text-slate-400 hover:bg-white/5 hover:text-white group"
                >
                    <Settings size={20} className="group-hover:rotate-90 transition-smooth" />
                    <span className="font-medium text-sm">{t('nav.settings')}</span>
                </Link>
            </div>
        </aside>
    );
}
