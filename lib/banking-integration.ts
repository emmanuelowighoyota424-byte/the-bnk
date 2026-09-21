/**
 * Banking Integration Service
 * Client-side coordinator for the application's own banking APIs.
 * Authentication and authorization are enforced by the API routes; this
 * client deliberately does not depend on Supabase or trust caller-supplied IDs.
 */

export class BankingIntegrationService {
  private userId: string | null = null
  private syncInterval: ReturnType<typeof setInterval> | null = null

  constructor(userId: string | null = null) {
    this.userId = userId
  }

  async initialize(userId: string) {
    this.userId = userId
    this.startRealTimeSync()
    await this.syncAllData()
  }

  private startRealTimeSync() {
    if (this.syncInterval) clearInterval(this.syncInterval)
    this.syncInterval = setInterval(() => {
      void this.syncAllData()
    }, 30000)
  }

  async syncAllData() {
    if (!this.userId) return

    try {
      const [accounts, transactions, notifications] = await Promise.all([
        this.fetchAccounts(),
        this.fetchTransactions(),
        this.fetchNotifications(),
      ])

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('banking-sync', {
          detail: { accounts, transactions, notifications },
        }))
      }
    } catch (error) {
      console.error('[Banking Integration] Sync error:', error)
    }
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.headers ?? {}),
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`)
    }
    return data
  }

  async fetchAccounts() {
    try {
      return await this.request('/api/accounts')
    } catch (error) {
      console.error('[Banking Integration] Fetch accounts error:', error)
      return { accounts: [] }
    }
  }

  async fetchTransactions(days = 30) {
    try {
      return await this.request(`/api/transactions?days=${encodeURIComponent(days)}`)
    } catch (error) {
      console.error('[Banking Integration] Fetch transactions error:', error)
      return { transactions: [] }
    }
  }

  async fetchNotifications() {
    try {
      return await this.request('/api/notifications')
    } catch (error) {
      console.error('[Banking Integration] Fetch notifications error:', error)
      return { notifications: [] }
    }
  }

  async createTransfer(transferData: {
    action: 'wire' | 'zelle' | 'ach' | 'internal' | 'bill_pay'
    fromAccountId: string
    toAccountId?: string
    amount: number
    description?: string
    recipientEmail?: string
    recipientPhone?: string
    recipientName?: string
    recipientBank?: string
    recipientRoutingNumber?: string
    recipientAccountNumber?: string
    scheduledDate?: string
    frequency?: string
    billPayee?: string
    billDueDate?: string
  }) {
    return this.request('/api/transfers', {
      method: 'POST',
      body: JSON.stringify(transferData),
    })
  }

  async sendZelle(fromAccountId: string, amount: number, recipientEmail: string, recipientName: string) {
    return this.createTransfer({ action: 'zelle', fromAccountId, amount, recipientEmail, recipientName })
  }

  async sendWire(
    fromAccountId: string,
    amount: number,
    recipientName: string,
    recipientBank: string,
    recipientRoutingNumber: string,
    recipientAccountNumber: string,
  ) {
    return this.createTransfer({
      action: 'wire',
      fromAccountId,
      amount,
      recipientName,
      recipientBank,
      recipientRoutingNumber,
      recipientAccountNumber,
    })
  }

  async getBills() {
    try {
      return await this.request('/api/bill-pay')
    } catch (error) {
      console.error('[Banking Integration] Fetch bills error:', error)
      return { bills: [] }
    }
  }

  async addBill(billData: {
    accountId: string
    payee: string
    amount: number
    category: string
    dueDate: string
    frequency: string
    accountNumber?: string
  }) {
    return this.request('/api/bill-pay', {
      method: 'POST',
      body: JSON.stringify(billData),
    })
  }

  async getCreditInfo() {
    try {
      return await this.request('/api/credit')
    } catch (error) {
      console.error('[Banking Integration] Fetch credit error:', error)
      return {}
    }
  }

  async getSettings() {
    try {
      return await this.request('/api/settings')
    } catch (error) {
      console.error('[Banking Integration] Fetch settings error:', error)
      return {}
    }
  }

  async updateSettings(settings: unknown) {
    return this.request('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    })
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId }),
    })
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    this.userId = null
  }
}

let instance: BankingIntegrationService | null = null

export function getBankingIntegration() {
  if (!instance) instance = new BankingIntegrationService()
  return instance
}
