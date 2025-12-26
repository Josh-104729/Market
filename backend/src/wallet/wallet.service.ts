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
  private readonly tronApiKey?: string;
  private readonly tronFullHosts: string[];

  constructor(
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
  ) {
    // Initialize TronWeb
    this.tronApiKey = process.env.TRON_PRO_API_KEY || process.env.TRONGRID_API_KEY;

    const fullNode = process.env.TRON_FULL_NODE || 'https://api.trongrid.io';
    const solidityNode = process.env.TRON_SOLIDITY_NODE || process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io';
    const eventServer = process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io';

    // Allow comma-separated fallback hosts for rate-limit resilience.
    // Example: TRON_FULL_NODES=https://api.trongrid.io,https://api.tronstack.io
    const fullHosts = (process.env.TRON_FULL_NODES || process.env.TRON_FULL_HOSTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.tronFullHosts = Array.from(new Set([fullNode, ...fullHosts]));

    this.tronWeb = this.createTronWeb({
      fullHost: this.tronFullHosts[0],
      solidityNode,
      eventServer,
    });
  }

  private createTronWeb(opts: { fullHost: string; solidityNode?: string; eventServer?: string }) {
    const headers = this.tronApiKey ? { 'TRON-PRO-API-KEY': this.tronApiKey } : undefined;
    return new TronWeb({
      fullHost: opts.fullHost,
      solidityNode: opts.solidityNode,
      eventServer: opts.eventServer,
      headers,
    });
  }

  private tronGridHeaders(): HeadersInit | undefined {
    if (!this.tronApiKey) return undefined;
    return { 'TRON-PRO-API-KEY': this.tronApiKey };
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getTronRetryTimeoutMs(): number {
    const v = Number(process.env.TRON_RETRY_TIMEOUT_MS || 90_000);
    return Number.isFinite(v) && v > 0 ? v : 90_000;
  }

  private getTronRetryBaseDelayMs(): number {
    const v = Number(process.env.TRON_RETRY_BASE_DELAY_MS || 750);
    return Number.isFinite(v) && v > 0 ? v : 750;
  }

  private async waitForTxConfirmation(
    tronWeb: any,
    txid: string,
    timeoutMs: number = Number(process.env.TRON_TX_CONFIRM_TIMEOUT_MS || 120_000),
    pollMs: number = Number(process.env.TRON_TX_CONFIRM_POLL_MS || 2_000),
  ): Promise<{ confirmed: boolean; receipt?: any }> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const info = await tronWeb.trx.getTransactionInfo(txid);
        // When confirmed, Tron returns receipt and blockNumber.
        const receipt = info?.receipt;
        const result = receipt?.result || receipt?.result?.toString?.();
        const blockNumber = info?.blockNumber;
        if (blockNumber || result === 'SUCCESS') {
          return { confirmed: true, receipt: info };
        }
      } catch (e) {
        // ignore intermittent / not found while pending
      }
      await this.sleep(pollMs);
    }
    return { confirmed: false };
  }

  private isRateLimitError(err: any): boolean {
    const msg = String(err?.message || '');
    const status = err?.response?.status;
    return status === 429 || msg.includes(' 429') || msg.includes('status code 429') || msg.includes('Unable to get params');
  }

  /**
   * Create a brand-new temp wallet (TRON) for a user.
   * The private key is encrypted at rest.
   */
  async createTempWallet(userId: string, network: WalletNetwork = WalletNetwork.TRON): Promise<TempWallet> {
    if (network !== WalletNetwork.TRON) {
      throw new BadRequestException(`Unsupported wallet network in WalletService: ${network}`);
    }

    const account = this.tronWeb.utils.accounts.generateAccount();
    const address = account.address.base58;
    const privateKey = account.privateKey; // 64 hex chars

    const encryptedPrivateKey = encrypt(privateKey);
    const encryptionKeyHash = getEncryptionKeyHash();

    const tempWallet = this.tempWalletRepository.create({
      userId,
      address,
      privateKey: encryptedPrivateKey,
      encryptionKeyHash,
      network: WalletNetwork.TRON,
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }

  async getOrCreateTempWallet(userId: string): Promise<TempWallet> {
    // Check if user has an active temp wallet for TRON
    const existingWallet = await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE, network: WalletNetwork.TRON },
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Generate new USDT TRC20 Normal wallet
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


  async getTempWallet(userId: string, network: WalletNetwork = WalletNetwork.TRON): Promise<TempWallet | null> {
    return await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE, network },
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
        { headers: this.tronGridHeaders() },
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
          { headers: this.tronGridHeaders() },
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
    // Set a default address for the contract call
    // For read-only operations, any valid address works
    const defaultAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';

    const solidityNode = process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io';
    const eventServer = process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io';
    const hosts = this.tronFullHosts.length ? this.tronFullHosts : ['https://api.trongrid.io'];

    // Keep retrying (with backoff) until success or timeout, rather than stopping early.
    // `retries` is kept for backward compatibility; timeout is the real limiter.
    const timeoutMs = this.getTronRetryTimeoutMs();
    const baseDelay = this.getTronRetryBaseDelayMs();
    const started = Date.now();
    let attempt = 0;
    while (Date.now() - started < timeoutMs) {
      const host = hosts[attempt % hosts.length];
      try {
        if (attempt > 0) {
          const delay = Math.min(baseDelay * Math.pow(2, Math.min(attempt - 1, 6)), 10_000);
          await this.sleep(delay);
        }

        // Use headers (TRON-PRO-API-KEY) + host fallback to reduce 429s.
        const tempTronWeb = this.createTronWeb({
          fullHost: host,
          solidityNode,
          eventServer,
        });
        tempTronWeb.setAddress(defaultAddress);

        const contract = await tempTronWeb.contract().at(this.USDT_CONTRACT);
        const balance = await contract.balanceOf(walletAddress).call();
        return Number(balance) / 1e6; // Convert from smallest unit to USDT (6 decimals)
      } catch (error) {
        if (this.isRateLimitError(error)) {
          console.warn(
            `Rate limited (429) when getting USDT balance via contract for ${walletAddress} (host=${host}), retrying...`,
          );
          attempt++;
          continue;
        }

        console.error('Error getting USDT balance via contract:', error);
        return 0;
      }
      attempt++;
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
        { headers: this.tronGridHeaders() },
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
   * Get TRX balance for a wallet address
   */
  async getTRXBalance(walletAddress: string): Promise<number> {
    try {
      const balance = await this.tronWeb.trx.getBalance(walletAddress);
      // TRX has 6 decimals
      return Number(balance) / 1e6;
    } catch (error) {
      console.error('Error getting TRX balance:', error);
      return 0;
    }
  }

  /**
   * Send TRX from a wallet to a destination address
   */
  async sendTRX(
    fromPrivateKey: string,
    toAddress: string,
    amountTRX: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
      const amount = Math.floor(amountTRX * 1e6); // TRX has 6 decimals
    const solidityNode = process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io';
    const eventServer = process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io';

    const hosts = this.tronFullHosts.length ? this.tronFullHosts : ['https://api.trongrid.io'];
    // Keep retrying until success (or timeout), then wait for confirmation before returning success.
    const timeoutMs = this.getTronRetryTimeoutMs();
    const baseDelay = this.getTronRetryBaseDelayMs();
    const started = Date.now();
    let attempt = 0;
    while (Date.now() - started < timeoutMs) {
      const host = hosts[attempt % hosts.length];
      try {
        const tw = this.createTronWeb({ fullHost: host, solidityNode, eventServer });
        tw.setPrivateKey(fromPrivateKey);

        const res = await tw.trx.sendTransaction(toAddress, amount);
        const txid =
          typeof res === 'string'
            ? res
            : res?.txid || res?.transaction?.txID || res?.transactionHash;

        if (res && (res?.result === true || typeof res === 'string') && txid) {
          // Wait until the transaction is confirmed on-chain.
          const confirmed = await this.waitForTxConfirmation(tw, txid);
          if (confirmed.confirmed) {
            return { success: true, transactionHash: txid };
          }
          return { success: false, error: 'TRX transaction sent but not confirmed before timeout' };
        }

        // If TronWeb returned something unexpected, fail fast.
        return { success: false, error: 'TRX transaction failed (no txid returned)' };
      } catch (error) {
        const is429 = this.isRateLimitError(error);
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error sending TRX (host=${host}):`, msg);

        if (is429) {
          const delay = Math.min(baseDelay * Math.pow(2, Math.min(attempt, 6)), 10_000);
          await this.sleep(delay);
          attempt++;
          continue;
        }

        return { success: false, error: msg || 'Unknown error' };
      }
      attempt++;
    }

    return {
      success: false,
      error: 'Timed out while sending TRX. Configure TRON_PRO_API_KEY / TRON_FULL_NODES or increase TRON_RETRY_TIMEOUT_MS.',
    };
  }

  /**
   * Transfer all USDT from temp wallet to master wallet
   * If temp wallet doesn't have enough TRX, master wallet sends 30 TRX first
   */
  async transferFromTempWalletToMaster(
    tempWallet: TempWallet,
  ): Promise<{ success: boolean; usdtTxHash?: string; trxTxHash?: string; error?: string }> {
    try {
      const masterWallet = this.getMasterWallet();
      const privateKey = await this.getDecryptedPrivateKey(tempWallet);

      // Get current balances
      const trxBalance = await this.getTRXBalance(tempWallet.address);

      const result: { success: boolean; usdtTxHash?: string; trxTxHash?: string; error?: string } = {
        success: false,
      };

      // Check if temp wallet has enough TRX for gas (need at least 10 TRX for USDT transfer)
      const MIN_TRX_REQUIRED = 10; // Minimum TRX needed for USDT transfer
      if (trxBalance < MIN_TRX_REQUIRED) {
        // Master wallet sends 30 TRX to temp wallet
        console.log(`Temp wallet has insufficient TRX (${trxBalance.toFixed(6)} TRX). Sending 30 TRX from master wallet...`);
        const trxResult = await this.sendTRX(masterWallet.privateKey, tempWallet.address, 30);
        if (!trxResult.success) {
          return {
            success: false,
            error: `Failed to send TRX to temp wallet: ${trxResult.error}`,
          };
        }
        result.trxTxHash = trxResult.transactionHash;

        // Wait for TRX transaction to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // Transfer USDT if balance > 0
      const usdtBalance = await this.getUSDTBalance(tempWallet.address);
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

  /**
   * Transfer remaining TRX from temp wallet to master wallet.
   * Keeps a small reserve for network fees to avoid "insufficient balance" failures.
   */
  async transferRemainingTRXFromTempToMaster(
    tempWallet: TempWallet,
  ): Promise<{ success: boolean; trxTxHash?: string; amountTransferred?: number; error?: string }> {
    try {
      const masterWallet = this.getMasterWallet();
      const privateKey = await this.getDecryptedPrivateKey(tempWallet);

      const trxBalance = await this.getTRXBalance(tempWallet.address);
      const reserve = Number(process.env.TRON_TEMP_WALLET_TRX_RESERVE || 0.1); // TRX to keep
      const amountToSend = Math.max(0, trxBalance - reserve);

      if (amountToSend <= 0) {
        return { success: false, error: `No TRX to transfer (balance=${trxBalance.toFixed(6)} TRX, reserve=${reserve} TRX)` };
      }

      const res = await this.sendTRX(privateKey, masterWallet.address, amountToSend);
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to send TRX' };
      }

      return { success: true, trxTxHash: res.transactionHash, amountTransferred: amountToSend };
    } catch (error) {
      console.error('Error transferring remaining TRX from temp wallet to master:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

