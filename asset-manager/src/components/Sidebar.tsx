'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, Activity, PieChart, Settings } from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: Home, color: 'text-blue-400' },
    { href: '/accounts', label: 'Accounts', icon: Wallet, color: 'text-emerald-400' },
    { href: '/transactions', label: 'Transactions', icon: Activity, color: 'text-purple-400' },
    { href: '/analytics', label: 'Analytics', icon: PieChart, color: 'text-amber-400' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            className="h-screen w-64 fixed left-0 top-0 z-50 flex flex-col"
            style={{ backgroundColor: 'var(--color-sidebar-bg)' }}
        >
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Asset Manager
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--color-sidebar-text)' }}>
                    Track your wealth
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
                            <span className="font-medium text-sm">{item.label}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-white/10">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-smooth text-slate-400 hover:bg-white/5 hover:text-white group"
                >
                    <Settings size={20} className="group-hover:rotate-90 transition-smooth" />
                    <span className="font-medium text-sm">Settings</span>
                </Link>
            </div>
        </aside>
    );
}
