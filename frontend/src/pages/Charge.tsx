import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi, Balance } from '../services/api'
import { showToast } from '../utils/toast'


function Charge() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
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

    setLoading(true)
    try {
      const response = await paymentApi.initiateCharge({
        amount: Number(amount),
      })
      // Redirect to the charge detail page
      navigate(`/charge/${response.walletAddress}`)
      showToast.success('Wallet address generated. Please send USDT to the address.')
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to initiate charge'
      showToast.error(message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Charge Balance</h1>
        <p className="text-slate-400 mb-6">Add USDT TRC20 to your account</p>

        {balance && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-emerald-600/20 border border-primary/30">
            <p className="text-sm text-slate-400 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-white">{Number(balance.amount).toFixed(2)} USDT</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-white mb-2">
                Amount (USDT)
              </label>
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> After clicking "Charge Balance", you will receive a unique wallet address. 
                Send the exact amount of USDT TRC20 to that address. Your balance will be updated automatically once the payment is confirmed.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Charge Balance'}
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

export default Charge
