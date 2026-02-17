'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowUpRight, DollarSign, Wallet, TrendingUp, Sparkles } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { format } = useCurrency();

  useEffect(() => {
    api.get('/accounts/')
      .then(res => setAccounts(res.data))
      .catch(err => console.error('Failed to load accounts', err))
      .finally(() => setLoading(false));
  }, []);

  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const bankAccounts = accounts.filter(a => a.type === 'BANK');
  const investAccounts = accounts.filter(a => a.type === 'STOCK' || a.type === 'CRYPTO');

  const stats = [
    {
      title: t('dashboard.net_worth'),
      value: format(totalBalance),
      icon: DollarSign,
      change: '+2.5%',
      changePositive: true,
      gradient: 'from-indigo-500 to-violet-500',
      softBg: 'bg-indigo-50',
    },
    {
      title: t('dashboard.bank_accounts'),
      value: bankAccounts.length.toString(),
      icon: Wallet,
      change: `${bankAccounts.length} ${t('dashboard.active')}`,
      changePositive: true,
      gradient: 'from-emerald-500 to-teal-500',
      softBg: 'bg-emerald-50',
    },
    {
      title: t('dashboard.investments'),
      value: investAccounts.length.toString(),
      icon: TrendingUp,
      change: `${investAccounts.length} ${t('dashboard.active')}`,
      changePositive: true,
      gradient: 'from-violet-500 to-purple-500',
      softBg: 'bg-violet-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
              Overview
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-zinc-500 mt-1 text-sm">{t('dashboard.subtitle')}</p>
        </div>
        <Link
          href="/accounts"
          className="btn-primary text-sm flex items-center gap-2"
        >
          {t('dashboard.manage_accounts')}
          <ArrowUpRight size={14} />
        </Link>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="card stat-card group cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className={`icon-badge ${stat.softBg}`}>
                  <Icon size={18} className={`bg-gradient-to-br ${stat.gradient} bg-clip-text`} style={{ color: 'transparent', backgroundImage: `linear-gradient(135deg, var(--brand-from), var(--brand-to))` }} />
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stat.changePositive ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-500 mb-0.5">{stat.title}</p>
              <p className="text-2xl font-extrabold text-zinc-900 tracking-tight">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Market Overview */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
          <h2 className="text-lg font-bold text-zinc-900">{t('dashboard.market_overview')}</h2>
        </div>
        <MarketTicker symbols={['AAPL', 'TSLA', 'MSFT', 'BTC-USD', 'ETH-USD', '0700.HK']} />
      </div>

      {/* Accounts Preview */}
      {accounts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
            <h2 className="text-lg font-bold text-zinc-900">{t('dashboard.your_accounts')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.slice(0, 8).map((acc) => (
              <div key={acc.id} className="card cursor-pointer group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center border border-zinc-200/50">
                    <span className="text-xs font-bold text-zinc-600">
                      {acc.type === 'BANK' ? '🏦' : acc.type === 'STOCK' ? '📈' : '₿'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900">{acc.name}</p>
                    <p className="text-[11px] text-zinc-400">{acc.type} • {acc.currency}</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-zinc-900 tracking-tight">{format(acc.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && accounts.length === 0 && (
        <div className="card text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
            <Wallet size={28} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-zinc-800">{t('dashboard.no_accounts')}</h3>
          <p className="text-zinc-500 mt-1 text-sm">{t('dashboard.no_accounts_desc')}</p>
          <Link href="/accounts" className="btn-primary inline-block mt-5 text-sm">
            {t('dashboard.add_account')}
          </Link>
        </div>
      )}
    </div>
  );
}

function MarketTicker({ symbols }: { symbols: string[] }) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const { format } = useCurrency();

  useEffect(() => {
    symbols.forEach(symbol => {
      api.get(`/market/price/${symbol}`).then(res => {
        setPrices(prev => ({ ...prev, [symbol]: res.data.price }));
      });
    });
  }, [symbols]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {symbols.map(symbol => (
        <div key={symbol} className="card p-4 text-center group cursor-pointer">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{symbol}</p>
          <p className={`text-base font-extrabold tracking-tight ${prices[symbol] ? 'text-zinc-900' : ''}`}>
            {prices[symbol] ? format(prices[symbol]) : (
              <span className="inline-block w-16 h-5 rounded animate-shimmer" />
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
