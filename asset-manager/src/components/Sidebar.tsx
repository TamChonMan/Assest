'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, Activity, PieChart, Briefcase, Settings } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

export default function Sidebar() {
    const pathname = usePathname();
    const { t } = useI18n();

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

            {/* Divider */}
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

            {/* Settings */}
            <div className="p-3">
                <Link
                    href="/settings"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-smooth group relative
                        ${pathname === '/settings'
                            ? 'bg-white/[0.08] text-white'
                            : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                        }`}
                >
                    {pathname === '/settings' && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-400" />
                    )}
                    <Settings size={18} className="group-hover:rotate-90 transition-all duration-500" />
                    <span className="font-medium text-[13px]">{t('nav.settings')}</span>
                </Link>
            </div>
        </aside>
    );
}
