'use client'

import React from 'react'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-end pb-4 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-slate-200 rounded" />
          <div className="h-7 w-64 bg-slate-200 rounded" />
          <div className="h-4 w-96 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded" />
      </div>

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="h-3 w-32 bg-slate-200 rounded" />
            <div className="h-7 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="h-60 bg-slate-100 rounded" />
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-48 bg-slate-100 rounded-full mx-auto w-48" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="h-96 bg-white border border-slate-200 rounded-lg p-6 space-y-3">
        <div className="h-4 w-48 bg-slate-200 rounded" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-slate-100 rounded-lg w-full" />
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-6 w-16 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
