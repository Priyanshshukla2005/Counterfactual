'use client'

import React from 'react'
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
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
        return <CheckCircle2 size={12} className="text-emerald-600" />
      case 'negative':
        return <AlertTriangle size={12} className="text-rose-600" />
      case 'indigo':
        return <TrendingUp size={12} className="text-indigo-600" />
      default:
        return <ShieldAlert size={12} className="text-slate-500" />
    }
  }

  const getBadgeClass = () => {
    switch (badgeTone) {
      case 'positive':
        return 'kpi-badge-positive'
      case 'negative':
        return 'kpi-badge-negative'
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200'
      default:
        return 'kpi-badge-neutral'
    }
  }

  return (
    <div className={`kpi-card tone-${tone}`}>
      <div className="kpi-label">
        <span>{label}</span>
        {tooltip && (
          <span title={tooltip} className="cursor-help text-slate-400 hover:text-slate-600">
            <HelpCircle size={13} />
          </span>
        )}
      </div>

      <div className="kpi-value tabular-nums">{value}</div>

      <div className="kpi-footer">
        <span className={getBadgeClass()}>
          {getBadgeIcon()}
          <span>{badgeText}</span>
        </span>
        <span className="text-slate-500 truncate text-[11px]">{subtitle}</span>
      </div>
    </div>
  )
}
