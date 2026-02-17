'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, Activity, PieChart, Briefcase, Settings, Globe, ChevronDown } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency, Currency } from '@/context/CurrencyContext';

export default function Sidebar() {
    const pathname = usePathname();
    const { locale, setLocale, t } = useI18n();
    const { currency, setCurrency, currencies } = useCurrency();

    const navItems = [
        { href: '/', labelKey: 'nav.dashboard', icon: Home },
        { href: '/accounts', labelKey: 'nav.accounts', icon: Wallet },
        { href: '/transactions', labelKey: 'nav.transactions', icon: Activity },
        { href: '/holdings', labelKey: 'nav.holdings', icon: Briefcase },
        { href: '/analytics', labelKey: 'nav.analytics', icon: PieChart },
    ];

    return (
        <aside className="h-screen w-64 fixed left-0 top-0 z-50 flex flex-col bg-[#18181b] border-r border-zinc-800/50">
            {/* Logo */}
            <div className="p-6 pb-5">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                        <span className="text-white font-black text-sm">A</span>
                    </div>
                    <h1 className="text-lg font-bold text-white tracking-tight">
                        {t('app.title')}
                    </h1>
                </div>
                <p className="text-[11px] text-zinc-500 ml-[42px] -mt-0.5">
                    {t('app.subtitle')}
                </p>
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-smooth group relative
                                ${isActive
                                    ? 'bg-white/[0.08] text-white'
                                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-400" />
                            )}
                            <Icon size={18} className={`transition-smooth ${isActive ? 'text-indigo-400' : 'group-hover:text-zinc-400'}`} />
                            <span className="font-medium text-[13px]">{t(item.labelKey)}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Controls */}
            <div className="px-3 pb-2 space-y-1.5">
                {/* Language */}
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <Globe size={14} className="text-zinc-600" />
                    <div className="flex flex-1 rounded-md overflow-hidden border border-zinc-800 bg-zinc-900/50">
                        <button
                            onClick={() => setLocale('en')}
                            className={`flex-1 text-[11px] py-1 font-medium transition-smooth cursor-pointer ${locale === 'en'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'text-zinc-600 hover:text-zinc-400'
                                }`}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLocale('zh')}
                            className={`flex-1 text-[11px] py-1 font-medium transition-smooth cursor-pointer ${locale === 'zh'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'text-zinc-600 hover:text-zinc-400'
                                }`}
                        >
                            中文
                        </button>
                    </div>
                </div>

                {/* Currency */}
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <ChevronDown size={14} className="text-zinc-600" />
                    <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-md text-[11px] text-zinc-400 py-1 px-2 cursor-pointer focus:outline-none focus:border-indigo-500/50 appearance-none"
                    >
                        {currencies.map((c) => (
                            <option key={c} value={c} className="bg-zinc-900 text-zinc-300">{c}</option>
                        ))}
                    </select>
                    <span className="text-[10px] text-zinc-600">{t('currency.settlement')}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

            {/* Settings */}
            <div className="p-3">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-smooth text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 group"
                >
                    <Settings size={18} className="group-hover:rotate-90 transition-all duration-500" />
                    <span className="font-medium text-[13px]">{t('nav.settings')}</span>
                </Link>
            </div>
        </aside>
    );
}
