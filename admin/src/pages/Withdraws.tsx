import { useState, useEffect } from 'react'
import { adminApi } from '../services/api'
import { showToast } from '../utils/toast'

interface Withdraw {
  id: string
  clientId: string
  client: {
    id: string
    email: string
    userName?: string
    firstName?: string
    lastName?: string
  } | null
  amount: number
  walletAddress: string
  status: string
  transactionHash?: string
  description?: string
  createdAt: string
  updatedAt: string
}

function Withdraws() {
  const [withdraws, setWithdraws] = useState<Withdraw[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadWithdraws()
  }, [])

  const loadWithdraws = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getWithdraws()
      setWithdraws(data)
      setError(null)
    } catch (err: any) {
      console.error('Failed to load withdraws:', err)
      setError(err.response?.data?.message || 'Failed to load withdraws')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (withdrawId: string) => {
    if (!confirm('Are you sure you want to accept this withdrawal request? This will transfer USDT from the master wallet to the user\'s address.')) {
      return
    }

    try {
      setAccepting(withdrawId)
      setError(null)
      const result = await adminApi.acceptWithdraw(withdrawId)
      
      showToast.success(
        <div>
          <div className="font-semibold">Withdrawal accepted!</div>
          <div className="text-sm mt-1">
            Amount: {Number(result.amount).toFixed(2)} USDT
          </div>
          <div className="text-xs mt-1 break-all">
            TX: {result.transactionHash}
          </div>
        </div>,
        { autoClose: 6000 }
      )
      
      // Reload withdraws to update status
      await loadWithdraws()
    } catch (err: any) {
      console.error('Accept withdraw failed:', err)
      let errorMessage = err.response?.data?.message || 'Failed to accept withdrawal'
      
      setError(errorMessage)
      showToast.error(
        <div>
          <div className="font-semibold">Withdrawal Failed</div>
          <div className="text-sm mt-1 whitespace-pre-line">{errorMessage}</div>
        </div>,
        { autoClose: 8000 }
      )
    } finally {
      setAccepting(null)
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-white">Loading withdrawals...</div>
          </div>
        </div>
      </div>
    )
  }

  const pendingWithdraws = withdraws.filter(w => w.status === 'pending')
  const otherWithdraws = withdraws.filter(w => w.status !== 'pending')

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Withdrawals</h1>
          <button
            onClick={loadWithdraws}
            className="px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
            {error}
          </div>
        )}

        {pendingWithdraws.length === 0 && otherWithdraws.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No withdrawal requests found</p>
          </div>
        ) : (
          <>
            {pendingWithdraws.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Pending Withdrawals</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">User</th>
                        <th className="text-right py-3 px-4 text-slate-300 font-semibold">Amount</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Wallet Address</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Requested</th>
                        <th className="text-center py-3 px-4 text-slate-300 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingWithdraws.map((withdraw) => (
                        <tr key={withdraw.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4">
                            {withdraw.client ? (
                              <div>
                                <div className="text-white text-sm">
                                  {withdraw.client.firstName} {withdraw.client.lastName}
                                </div>
                                <div className="text-slate-400 text-xs">{withdraw.client.email}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-white font-semibold">
                              {Number(withdraw.amount).toFixed(2)} USDT
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-sm">{withdraw.walletAddress}</span>
                              <button
                                onClick={() => copyToClipboard(withdraw.walletAddress)}
                                className="text-primary hover:text-primary/80 text-xs"
                              >
                                Copy
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-sm">
                            {formatDate(withdraw.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleAccept(withdraw.id)}
                              disabled={accepting === withdraw.id}
                              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                                accepting !== withdraw.id
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-slate-500/20 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {accepting === withdraw.id ? 'Processing...' : 'Accept'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {otherWithdraws.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Processed Withdrawals</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">User</th>
                        <th className="text-right py-3 px-4 text-slate-300 font-semibold">Amount</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Wallet Address</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Transaction</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherWithdraws.map((withdraw) => (
                        <tr key={withdraw.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4">
                            {withdraw.client ? (
                              <div>
                                <div className="text-white text-sm">
                                  {withdraw.client.firstName} {withdraw.client.lastName}
                                </div>
                                <div className="text-slate-400 text-xs">{withdraw.client.email}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-white font-semibold">
                              {Number(withdraw.amount).toFixed(2)} USDT
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-sm">{withdraw.walletAddress}</span>
                              <button
                                onClick={() => copyToClipboard(withdraw.walletAddress)}
                                className="text-primary hover:text-primary/80 text-xs"
                              >
                                Copy
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              withdraw.status === 'success' 
                                ? 'bg-green-500/20 text-green-300'
                                : withdraw.status === 'failed'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}>
                              {withdraw.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {withdraw.transactionHash ? (
                              <div className="flex items-center gap-2">
                                <span className="text-white font-mono text-xs break-all">
                                  {withdraw.transactionHash}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(withdraw.transactionHash!)}
                                  className="text-primary hover:text-primary/80 text-xs"
                                >
                                  Copy
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-sm">
                            {formatDate(withdraw.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Withdraws

