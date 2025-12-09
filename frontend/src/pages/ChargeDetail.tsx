import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { paymentApi, Balance } from '../services/api'
import { showToast } from '../utils/toast'

interface ChargeData {
  walletAddress: string
  amount: number
  platformFee: number
  total: number
  transactionId: string
  expiresAt: string
  status: string
  transactionHash?: string
}

function ChargeDetail() {
  const navigate = useNavigate()
  const { walletAddress } = useParams<{ walletAddress: string }>()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [chargeData, setChargeData] = useState<ChargeData | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      showToast.error('Invalid wallet address')
      navigate('/charge')
      return
    }

    // Fetch balance
    paymentApi.getBalance()
      .then(setBalance)
      .catch((error) => {
        console.error('Failed to fetch balance:', error)
      })

    // Fetch charge data
    paymentApi.getChargeByWalletAddress(walletAddress)
      .then((data) => {
        setChargeData(data)
        setTransactionStatus(data.status)
      })
      .catch((error) => {
        console.error('Failed to fetch charge data:', error)
        showToast.error('Failed to load charge information')
        navigate('/charge')
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current)
      }
    }
  }, [walletAddress, navigate])

  // Countdown timer effect - updates every second
  useEffect(() => {
    if (chargeData && transactionStatus === 'pending' && chargeData.expiresAt) {
      // Update countdown immediately
      setTimeRemaining(getTimeRemaining(chargeData.expiresAt))

      // Update countdown every second
      countdownRef.current = window.setInterval(() => {
        const remaining = getTimeRemaining(chargeData.expiresAt)
        setTimeRemaining(remaining)

        // If expired, stop the countdown
        if (remaining === 'Expired') {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current)
          }
        }
      }, 1000) // Update every second

      return () => {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current)
        }
      }
    } else {
      setTimeRemaining('')
    }
  }, [chargeData, transactionStatus])

  useEffect(() => {
    if (chargeData && transactionStatus === 'pending' && walletAddress) {
      // Start polling for status updates - refresh both status and full charge data
      intervalRef.current = window.setInterval(async () => {
        try {
          // Fetch both status and full charge data for real-time updates
          const [status, updatedChargeData] = await Promise.all([
            paymentApi.getChargeStatus(chargeData.transactionId),
            paymentApi.getChargeByWalletAddress(walletAddress).catch(() => null),
          ])

          // Update status
          const newStatus = status.status
          setTransactionStatus(newStatus)

          // Update charge data if available
          if (updatedChargeData) {
            setChargeData(updatedChargeData)
          }

          if (newStatus === 'success') {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current)
            }
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current)
            }
            showToast.success('Payment received! Your balance has been updated.')
            // Refresh balance
            const updatedBalance = await paymentApi.getBalance()
            setBalance(updatedBalance)
          } else if (newStatus === 'cancelled' || newStatus === 'failed') {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current)
            }
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current)
            }
            showToast.error('Transaction was cancelled or failed')
          }
        } catch (error) {
          console.error('Failed to check transaction status:', error)
        }
      }, 3000) // Poll every 3 seconds for faster updates

      return () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
        }
      }
    }
  }, [chargeData, transactionStatus, walletAddress])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
  }

  const generateQRCode = (text: string): string => {
    // Using a QR code API service
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`
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

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    // Format with leading zeros for better display
    const h = hours.toString().padStart(2, '0')
    const m = minutes.toString().padStart(2, '0')
    const s = seconds.toString().padStart(2, '0')
    
    return `${h}:${m}:${s}`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-white">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!chargeData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="text-center py-12">
            <p className="text-white mb-4">Charge information not found</p>
            <button
              onClick={() => navigate('/charge')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all"
            >
              Go to Charge Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Charge Balance</h1>
        <p className="text-slate-400 mb-6">Send USDT TRC20 to the address below</p>

        {balance && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-emerald-600/20 border border-primary/30">
            <p className="text-sm text-slate-400 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-white">{Number(balance.amount).toFixed(2)} USDT</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              transactionStatus === 'success' 
                ? 'text-green-400 bg-green-400/10' 
                : transactionStatus === 'pending'
                ? 'text-yellow-400 bg-yellow-400/10'
                : 'text-slate-400 bg-slate-400/10'
            }`}>
              {transactionStatus === 'success' ? 'PAID' : transactionStatus === 'pending' ? 'WAITING FOR PAYMENT' : transactionStatus.toUpperCase()}
            </span>
            {transactionStatus === 'pending' && (
              <span className="text-xs text-slate-400 animate-pulse">
                Checking for payment...
              </span>
            )}
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-xl">
              <img
                src={generateQRCode(chargeData.walletAddress)}
                alt="Wallet Address QR Code"
                className="w-64 h-64"
              />
            </div>
          </div>

          {/* Wallet Address */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Wallet Address
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chargeData.walletAddress}
                readOnly
                className="flex-1 px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(chargeData.walletAddress)}
                className="px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Amount Breakdown */}
          <div className="p-4 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>Amount:</span>
              <span className="font-semibold">{chargeData.amount.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Platform Fee:</span>
              <span className="font-semibold">{chargeData.platformFee.toFixed(2)} USDT</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between text-white">
              <span className="font-semibold">Total to Send:</span>
              <span className="font-bold text-lg">{chargeData.total.toFixed(2)} USDT</span>
            </div>
          </div>

          {/* Expiration */}
          {transactionStatus === 'pending' && chargeData.expiresAt && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <div className="text-center">
                <p className="text-xs text-yellow-400/70 mb-2">Time Remaining</p>
                <p className="text-3xl font-bold text-yellow-300 font-mono tracking-wider">
                  {timeRemaining || getTimeRemaining(chargeData.expiresAt)}
                </p>
                {timeRemaining === 'Expired' && (
                  <p className="text-xs text-red-400 mt-2">This transaction has expired</p>
                )}
              </div>
              <p className="text-xs text-yellow-400/70 text-center mt-3 pt-3 border-t border-yellow-500/20">
                Expires at: {formatDate(chargeData.expiresAt)}
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-300 mb-2">
              <strong>Instructions:</strong>
            </p>
            <ol className="text-sm text-blue-300/80 list-decimal list-inside space-y-1">
              <li>Send exactly <strong>{chargeData.total.toFixed(2)} USDT</strong> to the wallet address above</li>
              <li>Make sure you're sending USDT on the TRC20 network</li>
              <li>Your balance will be updated automatically once the payment is confirmed</li>
              <li>This page will update automatically when payment is received</li>
            </ol>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/charge')}
              className="flex-1 px-6 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-semibold hover:bg-white/5 transition-all"
            >
              {transactionStatus === 'success' ? 'Charge Again' : 'Back to Charge'}
            </button>
            {transactionStatus === 'pending' && (
              <button
                onClick={() => {
                  window.open(`https://tronscan.org/#/address/${chargeData.walletAddress}`, '_blank')
                }}
                className="px-6 py-3 rounded-xl bg-primary/20 border border-primary/30 text-primary font-semibold hover:bg-primary/30 transition-all"
              >
                View on TronScan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChargeDetail

