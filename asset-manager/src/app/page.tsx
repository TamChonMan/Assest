'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowUpRight, DollarSign, Wallet, TrendingUp, Sparkles, PieChart as PieIcon, Activity } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';
import AllocationChart from '@/components/dashboard/AllocationChart';
import NetWorthChart from '@/components/dashboard/NetWorthChart';

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

interface PortfolioSummary {
  total_invested: number;
  total_market_value: number;
  total_cash: number;
  total_equity: number;
  holdings: { symbol: string; market_value: number; tags?: string }[];
}

interface PortfolioSnapshot {
  date: string;
  total_equity: number;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const { t } = useI18n();
  const { format, convertFrom, formatFrom, symbol: currSymbol } = useCurrency();

  useEffect(() => {
    // 1. Fetch Accounts
    api.get('/accounts/')
      .then(res => setAccounts(res.data))
      .catch(err => console.error('Failed to load accounts', err));

    // 2. Fetch Portfolio Summary (Trigger Snapshot) -> Then History
    api.get('/portfolio/summary')
      .then(res => {
        setSummary(res.data);
        // Fetch history after snapshot is potentially created
        return api.get('/portfolio/history');
      })
      .then(res => setHistory(res.data))
      .catch(err => console.error('Failed to load portfolio data', err))
      .finally(() => setLoading(false));
  }, []);

  const totalBalance = accounts.reduce((acc, curr) => acc + convertFrom(curr.balance || 0, curr.currency), 0);
  const totalEquity = summary?.total_equity ? convertFrom(summary.total_equity, 'USD') : totalBalance; // Summary is in USD usually

  // Prepare Chart Data
  const allocationData = summary?.holdings.map(h => ({
    name: h.symbol,
    value: convertFrom(h.market_value, 'USD') // Convert USD market value to display currency
  })) || [];

  const historyData = history.map(h => ({
    date: h.date,
    value: convertFrom(h.total_equity, 'USD')
  }));

  const bankAccounts = accounts.filter(a => a.type === 'BANK');
  const investAccounts = accounts.filter(a => a.type === 'STOCK' || a.type === 'CRYPTO');

  // Use Summary data if available for stats (More accurate with market value)
  const displayNetWorth = summary ? totalEquity : totalBalance;

  const stats = [
    {
      title: t('dashboard.net_worth'),
      value: `${currSymbol}${displayNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      change: '+2.5%', // Placeholder for now (calc from history later)
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

      {/* Charts Section (New) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Net Worth Trend (2/3) */}
        <div className="lg:col-span-2 card min-h-[350px]">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-blue-500" />
            <h2 className="text-lg font-bold text-zinc-900">Total Asset Trend</h2>
          </div>
          <NetWorthChart data={historyData} />
        </div>

        {/* Allocation (1/3) */}
        <div className="card min-h-[350px]">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
            <h2 className="text-lg font-bold text-zinc-900">Allocation</h2>
          </div>
          <AllocationChart data={allocationData} />
        </div>
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
                <p className="text-xl font-extrabold text-zinc-900 tracking-tight">{formatFrom(acc.balance, acc.currency)}</p>
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
