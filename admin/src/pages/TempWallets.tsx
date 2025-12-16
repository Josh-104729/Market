import { useState, useEffect } from 'react'
import { adminApi } from '../services/api'
import { showToast } from '../utils/toast'

interface TempWallet {
  id: string
  userId: string
  user: {
    id: string
    email: string
    userName?: string
    firstName?: string
    lastName?: string
  } | null
  address: string
  status: string
  totalReceived: number
  usdtBalance: number
  lastCheckedAt?: string
  createdAt: string
  updatedAt: string
}

function TempWallets() {
  const [wallets, setWallets] = useState<TempWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadWallets()
  }, [])

  const loadWallets = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getTempWallets()
      setWallets(data)
      setError(null)
    } catch (err: any) {
      console.error('Failed to load temp wallets:', err)
      setError(err.response?.data?.message || 'Failed to load temp wallets')
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId)
    const usdtBalance = Number(wallet?.usdtBalance || 0)
    const hasUSDT = wallet && usdtBalance > 0

    if (!hasUSDT) {
      showToast.error('No USDT to transfer')
      return
    }

    const confirmMessage = `Are you sure you want to transfer ${usdtBalance.toFixed(2)} USDT from this wallet to the master wallet?`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setTransferring(walletId)
      setError(null)
      const result = await adminApi.transferFromTempWallet(walletId)

      // Show success toast with transaction details
      const message = (
        <div>
          <div className="font-semibold">Transfer successful!</div>
          {result.amountTransferred > 0 && (
            <div className="text-sm mt-1">
              Amount: {result.amountTransferred.toFixed(2)} USDT
            </div>
          )}
          {result.usdtTxHash && (
            <div className="text-xs mt-1 break-all">
              USDT TX: {result.usdtTxHash}
            </div>
          )}
        </div>
      )
      showToast.success(message, { autoClose: 6000 })

      // Wait a moment for blockchain to update, then reload wallets to update balances
      await new Promise(resolve => setTimeout(resolve, 2000))
      await loadWallets()
    } catch (err: any) {
      console.error('Transfer failed:', err)
      let errorMessage = err.response?.data?.message || 'Failed to transfer funds'

      setError(errorMessage)
      showToast.error(
        <div>
          <div className="font-semibold">Transfer Failed</div>
          <div className="text-sm mt-1 whitespace-pre-line">{errorMessage}</div>
        </div>,
        { autoClose: 8000 }
      )
    } finally {
      setTransferring(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-white">Loading temp wallets...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Temp Wallets</h1>
          <button
            onClick={loadWallets}
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

        {wallets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No temp wallets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Address</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">User</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>
                  <th className="text-right py-3 px-4 text-slate-300 font-semibold">
                    USDT Balance <span className="text-xs text-slate-500">(Real-time)</span>
                  </th>
                  <th className="text-right py-3 px-4 text-slate-300 font-semibold">Total Received</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Created</th>
                  <th className="text-center py-3 px-4 text-slate-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{wallet.address}</span>
                        <button
                          onClick={() => copyToClipboard(wallet.address)}
                          className="text-primary hover:text-primary/80 text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {wallet.user ? (
                        <div>
                          <div className="text-white text-sm">
                            {wallet.user.firstName} {wallet.user.lastName}
                          </div>
                          <div className="text-slate-400 text-xs">{wallet.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Unknown</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${wallet.status === 'ACTIVE'
                        ? 'bg-green-500/20 text-green-300'
                        : wallet.status === 'COMPLETED'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-500/20 text-slate-300'
                        }`}>
                        {wallet.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-semibold ${wallet.usdtBalance > 0 ? 'text-green-300' : 'text-slate-400'
                          }`}>
                          {Number(wallet.usdtBalance || 0).toFixed(2)} USDT
                        </span>
                        <span className="text-xs text-slate-500">Blockchain</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-slate-300 font-semibold">
                        {Number(wallet.totalReceived || 0).toFixed(2)} USDT
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {formatDate(wallet.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleTransfer(wallet.id)}
                        disabled={transferring === wallet.id || Number(wallet.usdtBalance || 0) <= 0}
                        className={`px-4 py-2 rounded-xl font-semibold transition-all ${Number(wallet.usdtBalance || 0) > 0 && transferring !== wallet.id
                          ? 'bg-primary text-white hover:bg-primary/90'
                          : 'bg-slate-500/20 text-slate-400 cursor-not-allowed'
                          }`}
                      >
                        {transferring === wallet.id ? 'Transferring...' : 'Transfer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> Click "Transfer" to manually transfer USDT from a temp wallet to the master wallet.
              Temp wallets are GasFree wallets, so no TRX transfer is needed.
              Once payment is received in a temp wallet, the user's balance is automatically credited.
              Admin must manually transfer funds from temp wallets to the master wallet.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm text-emerald-300">
              <strong>Real-time Balances:</strong> USDT balances are fetched directly from the blockchain in real-time.
              Click "Refresh" to update all balances.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TempWallets

