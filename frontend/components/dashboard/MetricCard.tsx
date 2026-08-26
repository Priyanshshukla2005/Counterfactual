'use client'

import React from 'react'
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  Activity,
} from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  subtitle: string
  badgeText: string
  badgeTone: 'positive' | 'negative' | 'neutral' | 'indigo'
  tone?: 'indigo' | 'green' | 'amber' | 'red'
  tooltip?: string
}

export function MetricCard({
  label,
  value,
  subtitle,
  badgeText,
  badgeTone,
  tone = 'indigo',
  tooltip,
}: MetricCardProps) {
  const getBadgeIcon = () => {
    switch (badgeTone) {
      case 'positive':
        return <CheckCircle2 size={12} className="text-emerald-400" />
      case 'negative':
        return <AlertTriangle size={12} className="text-rose-400" />
      case 'indigo':
        return <TrendingUp size={12} className="text-indigo-400" />
      default:
        return <Activity size={12} className="text-slate-400" />
    }
  }

  const getBadgeClass = () => {
    switch (badgeTone) {
      case 'positive':
        return 'kpi-badge-positive'
      case 'negative':
        return 'kpi-badge-negative'
      case 'indigo':
        return 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40'
      default:
        return 'kpi-badge-neutral'
    }
  }

  return (
    <div className={`kpi-card tone-${tone} group`}>
      <div className="kpi-label">
        <span>{label}</span>
        {tooltip && (
          <span title={tooltip} className="cursor-help text-slate-500 hover:text-slate-300 transition">
            <HelpCircle size={13} />
          </span>
        )}
      </div>

      <div className="kpi-value tabular-nums group-hover:text-indigo-300 transition-colors">
        {value}
      </div>

      <div className="kpi-footer">
        <span className={getBadgeClass()}>
          {getBadgeIcon()}
          <span>{badgeText}</span>
        </span>
        <span className="text-slate-400 truncate text-[11px] font-medium">{subtitle}</span>
      </div>
    </div>
  )
}
