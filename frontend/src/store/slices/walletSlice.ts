import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { walletApi, Wallet } from '../../services/api';
import { connectTronLink, getUSDTBalance } from '../../utils/tronWeb';
import { showToast } from '../../utils/toast';

interface WalletState {
  wallet: Wallet | null;
  isConnecting: boolean;
  balance: number | null;
  isConnected: boolean;
}

const initialState: WalletState = {
  wallet: null,
  isConnecting: false,
  balance: null,
  isConnected: false,
};

// Load wallet from API
export const fetchWallet = createAsyncThunk(
  'wallet/fetchWallet',
  async (_, { rejectWithValue }) => {
    try {
      const wallet = await walletApi.getMyWallet();
      if (wallet && wallet.walletAddress) {
        // Backend already includes balance, but try to refresh from blockchain if TronLink is available
        if (wallet.balance !== undefined) {
          // Try to get fresh balance from TronLink if available, otherwise use backend balance
          try {
            if (window.tronWeb && window.tronWeb.ready) {
              const balance = await getUSDTBalance(wallet.walletAddress);
              return { ...wallet, balance };
            }
          } catch (error) {
            console.error('Failed to fetch balance from TronLink, using backend balance:', error);
          }
          // Use backend balance if TronLink fails or not available
          return wallet;
        }
        // If no balance from backend, try TronLink
        try {
          const balance = await getUSDTBalance(wallet.walletAddress);
          return { ...wallet, balance };
        } catch (error) {
          console.error('Failed to fetch balance:', error);
          return wallet;
        }
      }
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch wallet');
    }
  }
);

// Connect wallet
export const connectWallet = createAsyncThunk(
  'wallet/connectWallet',
  async (_, { rejectWithValue }) => {
    try {
      // Connect to TronLink
      const address = await connectTronLink();
      
      // Save to backend (backend will fetch balance)
      const wallet = await walletApi.connect(address);
      
      // Try to get balance from TronLink, fallback to backend balance
      let balance = wallet.balance;
      try {
        if (window.tronWeb && window.tronWeb.ready) {
          balance = await getUSDTBalance(address);
        }
      } catch (error) {
        console.error('Failed to fetch balance from TronLink, using backend balance:', error);
        // Use backend balance if available
        balance = wallet.balance;
      }
      
      showToast.success('Wallet connected successfully');
      return { ...wallet, balance };
    } catch (error: any) {
      showToast.error(error.message || 'Failed to connect wallet');
      return rejectWithValue(error.message || 'Failed to connect wallet');
    }
  }
);

// Refresh balance
export const refreshBalance = createAsyncThunk(
  'wallet/refreshBalance',
  async (walletAddress: string, { rejectWithValue }) => {
    try {
      const balance = await getUSDTBalance(walletAddress);
      return balance;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to refresh balance');
    }
  }
);

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    disconnectWallet: (state) => {
      state.wallet = null;
      state.balance = null;
      state.isConnected = false;
    },
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch wallet
      .addCase(fetchWallet.pending, (state) => {
        state.isConnecting = true;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.wallet = action.payload;
        state.isConnected = !!action.payload;
        if (action.payload?.balance !== undefined) {
          state.balance = action.payload.balance;
        }
      })
      .addCase(fetchWallet.rejected, (state) => {
        state.isConnecting = false;
        state.wallet = null;
        state.isConnected = false;
      })
      // Connect wallet
      .addCase(connectWallet.pending, (state) => {
        state.isConnecting = true;
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.wallet = action.payload;
        state.isConnected = true;
        state.balance = action.payload.balance || null;
      })
      .addCase(connectWallet.rejected, (state) => {
        state.isConnecting = false;
      })
      // Refresh balance
      .addCase(refreshBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      });
  },
});

export const { disconnectWallet, setBalance } = walletSlice.actions;
export default walletSlice.reducer;

