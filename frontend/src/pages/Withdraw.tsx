import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi, Balance } from '../services/api'
import { showToast } from '../utils/toast'

function Withdraw() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [paymentNetwork, setPaymentNetwork] = useState<'USDT_TRC20' | 'USDC_POLYGON'>('USDT_TRC20')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    paymentApi.getBalance()
      .then(setBalance)
      .catch((error) => {
        console.error('Failed to fetch balance:', error)
        showToast.error('Failed to load balance')
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!amount || Number(amount) <= 0) {
      showToast.error('Please enter a valid amount')
      return
    }

    // Validate minimum withdrawal amount (5)
    const currency = paymentNetwork === 'USDC_POLYGON' ? 'USDC' : 'USDT'
    if (Number(amount) < 5) {
      showToast.error(`Minimum withdrawal amount is 5 ${currency}`)
      return
    }

    // Validate amount doesn't exceed balance
    if (!balance || Number(amount) > Number(balance.amount)) {
      showToast.error(`Insufficient balance. Available: ${Number(balance?.amount || 0).toFixed(2)} ${currency}`)
      return
    }

    if (!walletAddress.trim()) {
      showToast.error('Please enter wallet address')
      return
    }

    // Validate wallet address format based on network
    if (paymentNetwork === 'USDC_POLYGON') {
      // Polygon addresses are Ethereum addresses (0x followed by 40 hex characters)
      if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress.trim())) {
        showToast.error('Please enter a valid Polygon wallet address (0x followed by 40 hex characters)')
        return
      }
    } else {
      // Basic TRC20 address validation (starts with T and is 34 characters)
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress.trim())) {
        showToast.error('Please enter a valid TRC20 wallet address')
        return
      }
    }

    setLoading(true)
    try {
      await paymentApi.withdraw({
        amount: Number(amount),
        walletAddress: walletAddress.trim(),
        paymentNetwork: paymentNetwork,
      })
      showToast.success('Withdrawal request submitted successfully. It will be processed by admin.')
      setAmount('')
      setWalletAddress('')
      // Refresh balance
      const updatedBalance = await paymentApi.getBalance()
      setBalance(updatedBalance)
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to process withdrawal'
      showToast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleMaxAmount = () => {
    if (balance) {
      setAmount(Number(balance.amount).toFixed(2))
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Withdraw Balance</h1>
        <p className="text-neutral-400 mb-6">Withdraw funds to your wallet</p>

        {balance && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-emerald-600/20 border border-primary/30">
            <p className="text-sm text-neutral-400 mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-white">{Number(balance.amount).toFixed(2)} USD</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="paymentNetwork" className="block text-sm font-medium text-white mb-2">
              Payment Network
            </label>
            <select
              id="paymentNetwork"
              value={paymentNetwork}
              onChange={(e) => setPaymentNetwork(e.target.value as 'USDT_TRC20' | 'USDC_POLYGON')}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="USDT_TRC20">USDT TRC20</option>
              <option value="USDC_POLYGON">USDC Polygon</option>
            </select>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-white mb-2">
              Amount ({paymentNetwork === 'USDC_POLYGON' ? 'USDC' : 'USDT'})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                id="amount"
                step="0.01"
                min="5"
                max={balance ? Number(balance.amount) : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="5.00"
                required
              />
              <button
                type="button"
                onClick={handleMaxAmount}
                className="px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-all"
              >
                Max
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="walletAddress" className="block text-sm font-medium text-white mb-2">
              {paymentNetwork === 'USDC_POLYGON' ? 'Polygon' : 'TRC20'} Wallet Address
            </label>
            <input
              type="text"
              id="walletAddress"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              placeholder={paymentNetwork === 'USDC_POLYGON' ? '0x...' : 'Txxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
              required
            />
            <p className="mt-2 text-xs text-neutral-500">
              Enter your {paymentNetwork === 'USDC_POLYGON' ? 'Polygon wallet address (0x followed by 40 hex characters)' : 'TRC20 wallet address (starts with T)'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-300 mb-2">
              <strong>Note:</strong> Your withdrawal request will be reviewed by admin. 
              Please double-check your wallet address before submitting.
            </p>
            <p className="text-xs text-blue-400">
              Minimum withdrawal amount: 5 {paymentNetwork === 'USDC_POLYGON' ? 'USDC' : 'USDT'}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Withdraw'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-semibold hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Withdraw

