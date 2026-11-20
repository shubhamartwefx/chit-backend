import { Types } from 'mongoose';
import { Invoice } from '../invoices/invoice.model';
import { Installment } from '../installments/installment.model';
import { User } from '../users/user.model';
import { ListTransactionsQueryInput } from './transaction.validation';

export type LedgerItem = {
  id: string
  kind: 'invoice' | 'installment'
  Transactions_ID: string
  name: string
  phone: string
  userId: string
  role: string
  description: string
  amount: number
  date: string
  status: string
}

function statusUi(status: string): {
  status: 'Pending' | 'Completed' | 'Failed'
  badgeClass: string
} {
  const s = (status || '').toLowerCase()
  if (s === 'paid' || s === 'completed') {
    return {
      status: 'Completed',
      badgeClass: 'bg-primary-subtle text-primary',
    }
  }
  if (s === 'failed' || s === 'overdue') {
    return {
      status: 'Failed',
      badgeClass: 'bg-danger-subtle text-danger',
    }
  }
  return {
    status: 'Pending',
    badgeClass: 'bg-warning-subtle text-warning',
  }
}

export class TransactionService {
  async listPlatform(query: ListTransactionsQueryInput) {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit
    const kind = query.kind ?? 'all'

    const [invoices, installments] = await Promise.all([
      kind === 'installment'
        ? Promise.resolve([])
        : Invoice.find({})
            .sort({ issuedAt: -1 })
            .limit(200)
            .lean(),
      kind === 'invoice'
        ? Promise.resolve([])
        : Installment.find({})
            .sort({ createdAt: -1 })
            .limit(200)
            .lean(),
    ])

    const userIds = new Set<string>()
    for (const inv of invoices) {
      userIds.add(String(inv.userId))
    }
    for (const inst of installments) {
      if (inst.bidderId) userIds.add(String(inst.bidderId))
      userIds.add(String(inst.recordedBy))
    }

    const users = await User.find({
      _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) },
    })
      .select('name phone role')
      .lean()
    const userMap = new Map(users.map((u) => [String(u._id), u]))

    const items: Array<LedgerItem & { badgeClass: string; textColorClass: string }> =
      []

    for (const inv of invoices) {
      const user = userMap.get(String(inv.userId))
      const ui = statusUi(inv.status)
      items.push({
        id: String(inv._id),
        kind: 'invoice',
        Transactions_ID: inv.invoiceNumber || inv.orderNumber,
        name: user?.name ?? '—',
        phone: user?.phone ?? '—',
        userId: String(inv.userId),
        role: inv.role || user?.role || '—',
        description:
          inv.type === 'subscription'
            ? `Subscription${inv.planTitle ? `: ${inv.planTitle}` : ''}`
            : 'Signup verification payment',
        amount: inv.amount,
        date: inv.issuedAt?.toISOString?.() ?? String(inv.issuedAt),
        status: ui.status,
        badgeClass: ui.badgeClass,
        textColorClass: 'text-black',
      })
    }

    for (const inst of installments) {
      const bidderId = inst.bidderId ? String(inst.bidderId) : null
      const user = bidderId
        ? userMap.get(bidderId)
        : userMap.get(String(inst.recordedBy))
      const ui = statusUi(inst.status)
      items.push({
        id: String(inst._id),
        kind: 'installment',
        Transactions_ID: String(inst._id),
        name: user?.name ?? '—',
        phone: user?.phone ?? '—',
        userId: bidderId ?? String(inst.recordedBy),
        role: user?.role ?? '—',
        description: `Chit installment · month ${inst.monthNumber}`,
        amount: inst.amount,
        date:
          (inst.paidAt ?? inst.createdAt)?.toISOString?.() ??
          String(inst.paidAt ?? inst.createdAt),
        status: ui.status,
        badgeClass: ui.badgeClass,
        textColorClass: 'text-black',
      })
    }

    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    let filtered = items
    const q = query.q?.trim().toLowerCase()
    if (q) {
      filtered = items.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.phone.includes(q) ||
          row.Transactions_ID.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q)
      )
    }

    const total = filtered.length
    const pageItems = filtered.slice(skip, skip + limit)

    return {
      items: pageItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }
  }
}

export const transactionService = new TransactionService()
