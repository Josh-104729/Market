import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi, Transaction } from '../services/api'
import { showToast } from '../utils/toast'
import { useAppSelector } from '../store/hooks'

function Transactions() {
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const limit = 10

  useEffect(() => {
    loadTransactions()
  }, [page])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const response = await paymentApi.getTransactions({ page, limit })
      setTransactions(response.data)
      setTotalPages(response.totalPages)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to load transactions:', error)
      showToast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-400/10'
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/10'
      case 'failed':
        return 'text-red-400 bg-red-400/10'
      case 'cancelled':
        return 'text-neutral-400 bg-neutral-400/10'
      case 'draft':
        return 'text-blue-400 bg-blue-400/10'
      default:
        return 'text-neutral-400 bg-neutral-400/10'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'charge':
        return 'Charge'
      case 'withdraw':
        return 'Withdraw'
      case 'milestone_payment':
        return 'Milestone Payment'
      default:
        return type
    }
  }

  const getTransactionRole = (transaction: Transaction): { role: string; otherParty?: string } => {
    if (!user) return { role: 'User' }
    
    // For charge and withdraw, the user is the client (their own account)
    if (transaction.type === 'charge' || transaction.type === 'withdraw') {
      if (transaction.clientId === user.id) {
        return { role: 'User' }
      }
    }
    
    // For milestone payments
    if (transaction.type === 'milestone_payment') {
      if (transaction.clientId === user.id) {
        return {
          role: 'Client',
          otherParty: transaction.provider
            ? `${transaction.provider.firstName || ''} ${transaction.provider.lastName || ''}`.trim() || transaction.provider.userName || 'Provider'
            : 'Provider',
        }
      } else if (transaction.providerId === user.id) {
        return {
          role: 'Provider',
          otherParty: transaction.client
            ? `${transaction.client.firstName || ''} ${transaction.client.lastName || ''}`.trim() || transaction.client.userName || 'Client'
            : 'Client',
        }
      }
    }
    
    return { role: 'User' }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter transactions
  const filteredTransactions = transactions.filter((transaction) => {
    const typeMatch = filterType === 'all' || transaction.type === filterType
    const statusMatch = filterStatus === 'all' || transaction.status === filterStatus
    return typeMatch && statusMatch
  })

  // Calculate summary
  const summary = transactions.reduce(
    (acc, transaction) => {
      if (transaction.status === 'success') {
        if (transaction.type === 'charge' || transaction.type === 'milestone_payment') {
          acc.totalIn += Number(transaction.amount)
        } else if (transaction.type === 'withdraw') {
          acc.totalOut += Number(transaction.amount)
        }
      }
      return acc
    },
    { totalIn: 0, totalOut: 0 }
  )

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Transaction History</h1>
        <p className="text-neutral-400 mb-6">View all your transactions</p>

        {/* Summary Cards */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30">
              <p className="text-sm text-neutral-400 mb-1">Total In</p>
              <p className="text-2xl font-bold text-green-400">+{summary.totalIn.toFixed(2)} USD</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-600/20 border border-red-500/30">
              <p className="text-sm text-neutral-400 mb-1">Total Out</p>
              <p className="text-2xl font-bold text-red-400">-{summary.totalOut.toFixed(2)} USD</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="filterType" className="block text-sm font-medium text-white mb-2">
              Filter by Type
            </label>
            <select
              id="filterType"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="charge">Charge</option>
              <option value="withdraw">Withdraw</option>
              <option value="milestone_payment">Milestone Payment</option>
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="filterStatus" className="block text-sm font-medium text-white mb-2">
              Filter by Status
            </label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-neutral-400 mt-4">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-400">No transactions found</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-400">No transactions match the selected filters</p>
            <button
              onClick={() => {
                setFilterType('all')
                setFilterStatus('all')
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Type</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Role</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Amount</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Status</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Date</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Description</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-neutral-400">Hash/Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => {
                    const { role, otherParty } = getTransactionRole(transaction)
                    const isMilestonePayment = transaction.type === 'milestone_payment'
                    const isClient = role === 'Client'
                    const isProvider = role === 'Provider'
                    
                    // Determine if amount is positive (income) or negative (expense)
                    let isPositive = false
                    if (transaction.type === 'charge') {
                      isPositive = true
                    } else if (transaction.type === 'withdraw') {
                      isPositive = false
                    } else if (transaction.type === 'milestone_payment') {
                      // If user is provider, they received payment (positive)
                      // If user is client, they paid (negative)
                      isPositive = isProvider
                    }
                    
                    return (
                      <tr key={transaction.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4">
                          <span className="text-white font-medium">{getTypeLabel(transaction.type)}</span>
                        </td>
                        <td className="py-4 px-4">
                          {isMilestonePayment ? (
                            <div className="flex flex-col">
                              <span className={`text-xs font-semibold ${isClient ? 'text-blue-400' : isProvider ? 'text-purple-400' : 'text-neutral-400'}`}>
                                {role}
                              </span>
                              {otherParty && (
                                <span className="text-xs text-neutral-500 mt-1">with {otherParty}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : '-'}
                            {Number(transaction.amount).toFixed(2)} USD
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(transaction.status)}`}>
                            {transaction.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-neutral-400 text-sm">{formatDate(transaction.createdAt)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-300 text-sm">{transaction.description || '-'}</span>
                            {transaction.milestoneId && (
                              <button
                                onClick={() => {
                                  // Navigate to chat with milestone - you might need to adjust this based on your routing
                                  navigate(`/transactions?milestone=${transaction.milestoneId}`)
                                }}
                                className="text-primary hover:text-primary/80 text-xs underline"
                              >
                                View Milestone
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {transaction.transactionHash ? (
                            <a
                              href={`https://tronscan.org/#/transaction/${transaction.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 text-sm font-mono truncate max-w-xs block"
                              title={transaction.transactionHash}
                            >
                              {transaction.transactionHash.substring(0, 10)}...
                            </a>
                          ) : transaction.walletAddress ? (
                            <span className="text-neutral-400 text-sm font-mono truncate max-w-xs block" title={transaction.walletAddress}>
                              {transaction.walletAddress.substring(0, 10)}...
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredTransactions.map((transaction) => {
                const { role, otherParty } = getTransactionRole(transaction)
                const isMilestonePayment = transaction.type === 'milestone_payment'
                const isClient = role === 'Client'
                const isProvider = role === 'Provider'
                
                // Determine if amount is positive (income) or negative (expense)
                let isPositive = false
                if (transaction.type === 'charge') {
                  isPositive = true
                } else if (transaction.type === 'withdraw') {
                  isPositive = false
                } else if (transaction.type === 'milestone_payment') {
                  // If user is provider, they received payment (positive)
                  // If user is client, they paid (negative)
                  isPositive = isProvider
                }
                
                return (
                  <div
                    key={transaction.id}
                    className="p-4 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{getTypeLabel(transaction.type)}</span>
                          {isMilestonePayment && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              isClient ? 'text-blue-400 bg-blue-400/10' : isProvider ? 'text-purple-400 bg-purple-400/10' : 'text-neutral-400 bg-neutral-400/10'
                            }`}>
                              {role}
                            </span>
                          )}
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(transaction.status)}`}>
                            {transaction.status.toUpperCase()}
                          </span>
                        </div>
                        {isMilestonePayment && otherParty && (
                          <div className="mt-1">
                            <span className="text-xs text-neutral-500">with {otherParty}</span>
                          </div>
                        )}
                      </div>
                      <span className={`font-semibold text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : '-'}
                        {Number(transaction.amount).toFixed(2)} USD
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-neutral-400">Date: </span>
                        <span className="text-neutral-300">{formatDate(transaction.createdAt)}</span>
                      </div>
                      {transaction.description && (
                        <div>
                          <span className="text-neutral-400">Description: </span>
                          <span className="text-neutral-300">{transaction.description}</span>
                        </div>
                      )}
                      {transaction.milestoneId && (
                        <div>
                          <button
                            onClick={() => navigate(`/transactions?milestone=${transaction.milestoneId}`)}
                            className="text-primary hover:text-primary/80 text-xs underline"
                          >
                            View Milestone
                          </button>
                        </div>
                      )}
                      {transaction.transactionHash && (
                        <div>
                          <span className="text-neutral-400">Hash: </span>
                          <a
                            href={`https://tronscan.org/#/transaction/${transaction.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 font-mono text-xs"
                          >
                            {transaction.transactionHash.substring(0, 20)}...
                          </a>
                        </div>
                      )}
                      {transaction.walletAddress && (
                        <div>
                          <span className="text-neutral-400">Address: </span>
                          <span className="text-neutral-300 font-mono text-xs">{transaction.walletAddress.substring(0, 20)}...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-6 border-t border-white/10 gap-4">
                <div className="text-sm text-neutral-400">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} transactions
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-medium hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 10) {
                        pageNum = i + 1
                      } else if (page <= 5) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 4) {
                        pageNum = totalPages - 9 + i
                      } else {
                        pageNum = page - 4 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            page === pageNum
                              ? 'bg-primary text-white'
                              : 'bg-[rgba(2,4,8,0.7)] border border-white/10 text-neutral-400 hover:bg-white/5'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="px-4 py-2 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-medium hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Transactions

