"use client";

import {
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Zap,
  DollarSign,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

export default function FinanceOverview() {
  const stats = [
    {
      title: "Total Net Worth",
      value: "$142,850.00",
      change: "+14.2%",
      trend: "up",
      subtext: "vs last month",
      icon: DollarSign,
      color: "emerald",
    },
    {
      title: "Crypto Holdings",
      value: "$68,420.50",
      change: "+22.8%",
      trend: "up",
      subtext: "BTC, ETH, SOL",
      icon: Wallet,
      color: "indigo",
    },
    {
      title: "Active Investments",
      value: "$54,190.00",
      change: "+6.1%",
      trend: "up",
      subtext: "Equities & Index Funds",
      icon: TrendingUp,
      color: "cyan",
    },
    {
      title: "Liquid Reserves",
      value: "$20,239.50",
      change: "Stable",
      trend: "neutral",
      subtext: "High Yield Savings",
      icon: Activity,
      color: "amber",
    },
  ];

  const recentTransactions = [
    {
      id: "tx-1",
      title: "Stripe Payout - SaaS Revenue",
      category: "Income",
      date: "Today, 09:30 AM",
      amount: "+$4,250.00",
      isPositive: true,
      status: "Settled",
    },
    {
      id: "tx-2",
      title: "Ethereum Validator Staking",
      category: "Crypto",
      date: "Yesterday",
      amount: "-$3,200.00",
      isPositive: false,
      status: "Settled",
    },
    {
      id: "tx-3",
      title: "AWS Cloud Infrastructure",
      category: "Operations",
      date: "Oct 16, 2026",
      amount: "-$420.80",
      isPositive: false,
      status: "Settled",
    },
    {
      id: "tx-4",
      title: "Dividend Yield - Vanguard VOO",
      category: "Dividends",
      date: "Oct 15, 2026",
      amount: "+$890.15",
      isPositive: true,
      status: "Settled",
    },
  ];

  const supabaseFeatures = [
    {
      icon: ShieldCheck,
      title: "Row Level Security (RLS)",
      desc: "Financial data is isolated per-user with Postgres policies.",
    },
    {
      icon: Zap,
      title: "Realtime WebSocket Sync",
      desc: "Instant ledger and balance updates with zero lag.",
    },
    {
      icon: Layers,
      title: "Next.js App Router & SSR",
      desc: "Server-side authenticated queries with @supabase/ssr.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-lg backdrop-blur-md hover:border-zinc-700/80 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{stat.title}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 text-emerald-400 border border-zinc-700/50">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-emerald-400 flex items-center">
                    <ArrowUpRight className="h-3 w-3 inline" />
                    {stat.change}
                  </span>
                  <span className="text-zinc-500">{stat.subtext}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Transactions + Supabase Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Recent Transactions</h3>
              <p className="text-xs text-zinc-400">Synced in real-time with Deku Finance ledger</p>
            </div>
            <button className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
              View All History →
            </button>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 hover:bg-zinc-800/20 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                      tx.isPositive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300"
                    }`}
                  >
                    {tx.isPositive ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{tx.title}</div>
                    <div className="text-xs text-zinc-500">
                      {tx.category} • {tx.date}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-sm font-semibold ${
                      tx.isPositive ? "text-emerald-400" : "text-zinc-200"
                    }`}
                  >
                    {tx.amount}
                  </div>
                  <span className="inline-block text-[10px] font-medium text-zinc-400 bg-zinc-800/70 border border-zinc-700/60 px-2 py-0.5 rounded-full mt-0.5">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supabase Architecture Card */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Architecture Ready</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Deku Finance is configured for enterprise-grade Supabase Postgres features.
            </p>

            <div className="space-y-4">
              {supabaseFeatures.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-zinc-950/40 p-3 border border-zinc-800/60">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">{item.title}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Database Engine</span>
              <span className="font-mono text-zinc-300">PostgreSQL 15</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
