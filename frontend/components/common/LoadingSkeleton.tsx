'use client'

import React from 'react'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-end pb-4 border-b border-slate-800">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-slate-800 rounded" />
          <div className="h-7 w-64 bg-slate-800 rounded" />
          <div className="h-4 w-96 bg-slate-900 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-800 rounded" />
      </div>

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="h-3 w-32 bg-slate-800 rounded" />
            <div className="h-7 w-40 bg-slate-800 rounded" />
            <div className="h-3 w-24 bg-slate-900 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 h-84 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="h-4 w-48 bg-slate-800 rounded" />
          <div className="h-64 bg-slate-950 rounded-lg" />
        </div>
        <div className="lg:col-span-5 h-84 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="h-4 w-40 bg-slate-800 rounded" />
          <div className="h-52 bg-slate-950 rounded-full mx-auto w-52" />
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-slate-900 rounded-lg w-full" />
      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-4 w-32 bg-slate-800 rounded" />
              <div className="h-3 w-20 bg-slate-900 rounded" />
            </div>
            <div className="h-4 w-24 bg-slate-800 rounded" />
            <div className="h-6 w-16 bg-slate-850 rounded" />
            <div className="h-4 w-20 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
