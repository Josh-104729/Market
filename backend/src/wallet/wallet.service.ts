import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempWallet, TempWalletStatus, WalletNetwork } from '../entities/temp-wallet.entity';
import { encrypt, decrypt, getEncryptionKeyHash } from '../utils/encryption.util';

// Use require for TronWeb as it's a CommonJS module
const TronWebModule = require('tronweb');
const TronWeb = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;

@Injectable()
export class WalletService {
  private tronWeb: any;
  private readonly USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20 contract address

  constructor(
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
  ) {
    // Initialize TronWeb
    const fullNode = process.env.TRON_FULL_NODE || 'https://api.trongrid.io';
    const solidityNode = process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io';
    const eventServer = process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io';

    this.tronWeb = new TronWeb({
      fullHost: fullNode,
      solidityNode: solidityNode,
      eventServer: eventServer,
    });
  }

  async getOrCreateTempWallet(userId: string): Promise<TempWallet> {
    // Check if user has an active temp wallet for TRON
    const existingWallet = await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE, network: WalletNetwork.TRON },
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Generate new USDT TRC20 GasFree wallet
    // Note: Temp wallets are GasFree wallets
    const account = this.tronWeb.utils.accounts.generateAccount();
    const address = account.address.base58;
    const privateKey = account.privateKey;

    // Encrypt private key before storing
    const encryptedPrivateKey = encrypt(privateKey);
    // Store the hash of the encryption key used, so we know which key to use for decryption
    const encryptionKeyHash = getEncryptionKeyHash();

    const tempWallet = this.tempWalletRepository.create({
      userId,
      address,
      privateKey: encryptedPrivateKey,
      encryptionKeyHash: encryptionKeyHash,
      network: WalletNetwork.TRON,
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }


  async getTempWallet(userId: string): Promise<TempWallet | null> {
    return await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE, network: WalletNetwork.TRON },
    });
  }

  async getDecryptedPrivateKey(tempWallet: TempWallet): Promise<string> {
    try {
      // Try to decrypt the private key using the stored encryption key hash
      // This ensures we use the correct key that was used to encrypt this wallet
      return decrypt(tempWallet.privateKey, tempWallet.encryptionKeyHash);
    } catch (error) {
      // Check if the private key might be stored in plain text (for old wallets created before encryption)
      // Tron private keys are 64 hex characters
      const privateKeyPattern = /^[0-9a-fA-F]{64}$/;
      if (privateKeyPattern.test(tempWallet.privateKey)) {
        // It's already in plain text, return it directly
        return tempWallet.privateKey;
      }

      // If it's not plain text and decryption failed, it means the encryption key changed
      console.error(`Failed to decrypt private key for wallet ${tempWallet.id} (${tempWallet.address}):`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const keyHashInfo = tempWallet.encryptionKeyHash
        ? ` Wallet was encrypted with key hash: ${tempWallet.encryptionKeyHash}.`
        : ' Wallet does not have an encryption key hash stored (old wallet).';
      throw new BadRequestException(
        `Failed to decrypt wallet private key for wallet ${tempWallet.id} (${tempWallet.address}).` +
        keyHashInfo +
        ` The wallet was encrypted with a different key. ` +
        `If you know the old encryption key, set WALLET_ENCRYPTION_KEY_FALLBACKS environment variable ` +
        `with comma-separated old keys (e.g., WALLET_ENCRYPTION_KEY_FALLBACKS=old_key1,old_key2). ` +
        `Original error: ${errorMessage}`
      );
    }
  }

  async checkWalletPayment(
    walletAddress: string,
    expectedAmount: number,
    tolerance: number = 0.01,
  ): Promise<{ success: boolean; transactionHash?: string; amount?: number }> {
    try {
      // Get TRC20 token transactions using TronGrid API
      const tronGridUrl = process.env.TRON_GRID_URL || 'https://api.trongrid.io';
      const response = await fetch(
        `${tronGridUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_confirmed=true&limit=50&contract_address=${this.USDT_CONTRACT}`,
      );

      if (!response.ok) {
        console.error('Failed to fetch transactions from TronGrid');
        return { success: false };
      }

      const data = await response.json();
      const transactions = data.data || [];

      // Check for matching transactions
      for (const tx of transactions) {
        if (tx.type === 'Transfer' && tx.to === walletAddress) {
          const amount = Number(tx.value) / 1e6; // USDT has 6 decimals

          // Check if amount matches expected (within tolerance)
          if (Math.abs(amount - expectedAmount) <= tolerance) {
            return {
              success: true,
              transactionHash: tx.transaction_id,
              amount: amount,
            };
          }
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Error checking wallet payment:', error);
      return { success: false };
    }
  }


  async getUSDTBalance(walletAddress: string, retries: number = 3): Promise<number> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add delay for retries to avoid rate limiting
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Use TronGrid API to get TRC20 token balance (more reliable and doesn't require owner address)
        const tronGridUrl = process.env.TRON_GRID_URL || 'https://api.trongrid.io';
        const response = await fetch(
          `${tronGridUrl}/v1/accounts/${walletAddress}/tokens?contract_address=${this.USDT_CONTRACT}`,
        );

        if (response.ok) {
          const data = await response.json();
          const tokens = data.data || [];

          // Find USDT token
          const usdtToken = tokens.find((token: any) =>
            token.token_address === this.USDT_CONTRACT ||
            token.contract_address === this.USDT_CONTRACT
          );

          if (usdtToken && usdtToken.balance) {
            // Balance is already in the smallest unit, convert to USDT (6 decimals)
            return Number(usdtToken.balance) / 1e6;
          }
        }

        // If we get 429 (rate limit), retry with backoff
        if (response.status === 429 && attempt < retries - 1) {
          console.warn(`Rate limited (429) when getting USDT balance for ${walletAddress}, retrying... (attempt ${attempt + 1}/${retries})`);
          continue;
        }

        // Fallback to contract call with default address
        return await this.getUSDTBalanceViaContract(walletAddress, retries);
      } catch (error) {
        // If it's a rate limit error and we have retries left, continue
        if (attempt < retries - 1 && (error as any)?.response?.status === 429) {
          console.warn(`Rate limited (429) when getting USDT balance for ${walletAddress}, retrying... (attempt ${attempt + 1}/${retries})`);
          continue;
        }

        if (attempt === retries - 1) {
          console.error('Error getting USDT balance via API, trying contract call:', error);
          // Last attempt, try contract call
          return await this.getUSDTBalanceViaContract(walletAddress, 1);
        }
      }
    }

    // If all retries failed, return 0
    return 0;
  }

  private async getUSDTBalanceViaContract(walletAddress: string, retries: number = 1): Promise<number> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add delay for retries to avoid rate limiting
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Set a default address for the contract call
        // For read-only operations, any valid address works
        const defaultAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';

        // Create a temporary TronWeb instance with default address
        const fullNode = process.env.TRON_FULL_NODE || 'https://api.trongrid.io';
        const solidityNode = process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io';
        const eventServer = process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io';

        const tempTronWeb = new TronWeb({
          fullHost: fullNode,
          solidityNode: solidityNode,
          eventServer: eventServer,
        });

        // Set default address for contract calls
        tempTronWeb.setAddress(defaultAddress);

        const contract = await tempTronWeb.contract().at(this.USDT_CONTRACT);
        const balance = await contract.balanceOf(walletAddress).call();
        return Number(balance) / 1e6; // Convert from smallest unit to USDT (6 decimals)
      } catch (error) {
        // If it's a rate limit error and we have retries left, continue
        if (attempt < retries - 1 && ((error as any)?.response?.status === 429 || (error as any)?.message?.includes('429'))) {
          console.warn(`Rate limited (429) when getting USDT balance via contract for ${walletAddress}, retrying... (attempt ${attempt + 1}/${retries})`);
          continue;
        }

        if (attempt === retries - 1) {
          console.error('Error getting USDT balance via contract:', error);
          return 0;
        }
      }
    }

    return 0;
  }

  async updateWalletLastChecked(walletId: string): Promise<void> {
    await this.tempWalletRepository.update(walletId, {
      lastCheckedAt: new Date(),
    });
  }

  /**
   * Get all incoming USDT transactions for a wallet address
   * Returns all transfers received by this wallet, regardless of amount
   */
  async getIncomingUSDTTransactions(
    walletAddress: string,
    limit: number = 50,
  ): Promise<Array<{ transactionHash: string; amount: number; timestamp: number; from: string }>> {
    try {
      // Get TRC20 token transactions using TronGrid API
      const tronGridUrl = process.env.TRON_GRID_URL || 'https://api.trongrid.io';
      const response = await fetch(
        `${tronGridUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_confirmed=true&limit=${limit}&contract_address=${this.USDT_CONTRACT}`,
      );

      if (!response.ok) {
        console.error('Failed to fetch transactions from TronGrid');
        return [];
      }

      const data = await response.json();
      const transactions = data.data || [];

      // Filter for incoming transfers (where 'to' matches our wallet address)
      const incomingTransactions = transactions
        .filter((tx: any) => tx.type === 'Transfer' && tx.to === walletAddress)
        .map((tx: any) => ({
          transactionHash: tx.transaction_id,
          amount: Number(tx.value) / 1e6, // USDT has 6 decimals
          timestamp: tx.block_timestamp || Date.now(),
          from: tx.from || '',
        }));

      return incomingTransactions;
    } catch (error) {
      console.error('Error getting incoming USDT transactions:', error);
      return [];
    }
  }

  /**
   * Send USDT (TRC20) from a wallet to a destination address
   */
  async sendUSDT(
    fromPrivateKey: string,
    toAddress: string,
    amountUSDT: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      this.tronWeb.setPrivateKey(fromPrivateKey);
      const amount = Math.floor(amountUSDT * 1e6); // USDT has 6 decimals

      const contract = await this.tronWeb.contract().at(this.USDT_CONTRACT);
      const transaction = await contract.transfer(toAddress, amount).send();

      if (transaction) {
        return {
          success: true,
          transactionHash: transaction,
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed',
        };
      }
    } catch (error) {
      console.error('Error sending USDT:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get master wallet address and private key from environment
   */
  getMasterWallet(): { address: string; privateKey: string } {
    const masterWalletAddress = process.env.TRON_MASTER_WALLET_ADDRESS;
    const masterWalletPrivateKey = process.env.TRON_MASTER_WALLET_PRIVATE_KEY;

    if (!masterWalletAddress || !masterWalletPrivateKey) {
      throw new BadRequestException(
        'Master wallet not configured. Please set TRON_MASTER_WALLET_ADDRESS and TRON_MASTER_WALLET_PRIVATE_KEY environment variables.',
      );
    }

    return {
      address: masterWalletAddress,
      privateKey: masterWalletPrivateKey,
    };
  }

  /**
   * Transfer all USDT from temp wallet to master wallet
   * Note: Temp wallets are GasFree wallets
   */
  async transferFromTempWalletToMaster(
    tempWallet: TempWallet,
  ): Promise<{ success: boolean; usdtTxHash?: string; error?: string }> {
    try {
      const masterWallet = this.getMasterWallet();
      const privateKey = await this.getDecryptedPrivateKey(tempWallet);

      // Get current balances
      const usdtBalance = await this.getUSDTBalance(tempWallet.address);

      const result: { success: boolean; usdtTxHash?: string; error?: string } = {
        success: false,
      };

      // Transfer USDT if balance > 0
      console.log('usdtBalance', usdtBalance);
      if (usdtBalance > 0.000001) {
        const usdtResult = await this.sendUSDT(privateKey, masterWallet.address, usdtBalance);
        if (!usdtResult.success) {
          return {
            success: false,
            error: `Failed to transfer USDT: ${usdtResult.error}`,
          };
        }
        result.usdtTxHash = usdtResult.transactionHash;

        // Wait a bit for transaction to be processed
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        result.success = false;
        result.error = `No USDT to transfer.`;
        return result;
      }

      result.success = true;
      return result;
    } catch (error) {
      console.error('Error transferring from temp wallet to master:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

