'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface RealtimeSubscription {
  schema: string
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
}

interface RealtimeUpdate {
  schema: string
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
  timestamp: string
}

interface RealtimeContextType {
  subscribe: (subscription: RealtimeSubscription, callback: (update: RealtimeUpdate) => void) => () => void
  isConnected: boolean
  lastUpdate: RealtimeUpdate | null
  financeTables: Set<string>
  hrTables: Set<string>
  inventoryTables: Set<string>
  securityTables: Set<string>
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

/**
 * Database-agnostic realtime facade.
 * Supabase realtime was intentionally removed; the application uses its
 * Prisma/PostgreSQL backend. Subscribers are retained locally so UI code can
 * continue to use the same interface while server push is added later.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null)
  const subscriptionsRef = useRef(new Map<string, Set<(update: RealtimeUpdate) => void>>())

  const financeTables = useMemo(() => new Set(['customers', 'accounts', 'transactions', 'transfers', 'bills']), [])
  const hrTables = useMemo(() => new Set(['departments', 'employee', 'attendance', 'payroll', 'leave_requests']), [])
  const inventoryTables = useMemo(() => new Set(['categories', 'products', 'suppliers', 'stock_transactions', 'purchase_orders']), [])
  const securityTables = useMemo(() => new Set(['users', 'roles', 'permissions', 'audit_logs', 'sessions']), [])

  const subscribe = useCallback((subscription: RealtimeSubscription, callback: (update: RealtimeUpdate) => void) => {
    const key = `${subscription.schema}.${subscription.table}`
    let listeners = subscriptionsRef.current.get(key)
    if (!listeners) {
      listeners = new Set()
      subscriptionsRef.current.set(key, listeners)
    }
    listeners.add(callback)

    return () => {
      const current = subscriptionsRef.current.get(key)
      current?.delete(callback)
      if (current && current.size === 0) subscriptionsRef.current.delete(key)
    }
  }, [])

  useEffect(() => () => subscriptionsRef.current.clear(), [])

  const value = useMemo<RealtimeContextType>(() => ({
    subscribe,
    isConnected: false,
    lastUpdate,
    financeTables,
    hrTables,
    inventoryTables,
    securityTables,
  }), [subscribe, lastUpdate, financeTables, hrTables, inventoryTables, securityTables])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) throw new Error('useRealtime must be used within RealtimeProvider')
  return context
}
