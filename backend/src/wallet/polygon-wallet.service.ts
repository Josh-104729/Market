import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempWallet, TempWalletStatus, WalletNetwork } from '../entities/temp-wallet.entity';
import { encrypt, decrypt, getEncryptionKeyHash } from '../utils/encryption.util';
import { ethers } from 'ethers';

@Injectable()
export class PolygonWalletService {
  private provider: ethers.JsonRpcProvider;
  /**
   * Polygon has (at least) two commonly-used "USDC" contracts:
   * - Native USDC (Circle): 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
   * - Bridged USDC (PoS):   0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
   *
   * If you query only one, you can get a misleading 0 balance.
   *
   * Override with:
   * - POLYGON_USDC_CONTRACT (single address), or
   * - POLYGON_USDC_CONTRACTS (comma-separated list of addresses)
   */
  private readonly USDC_CONTRACTS: string[] = (() => {
    const single = (process.env.POLYGON_USDC_CONTRACT || '').trim();
    if (single) return [single];

    const multi = (process.env.POLYGON_USDC_CONTRACTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (multi.length) return multi;

    // Defaults (Polygon mainnet)
    return [
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Bridged USDC (PoS)
    ];
  })();
  private readonly POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

  constructor(
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
  ) {
    // Initialize Polygon provider
    this.provider = new ethers.JsonRpcProvider(this.POLYGON_RPC_URL);
  }

  private getPrimaryUSDCContractAddress(): string {
    if (!this.USDC_CONTRACTS.length) {
      throw new BadRequestException('No Polygon USDC contract configured');
    }
    return this.USDC_CONTRACTS[0];
  }

  /**
   * Returns per-contract balances for configured Polygon "USDC" contracts.
   * This is useful because users may hold native USDC or bridged USDC.
   */
  private async getUSDCBalancesByContract(
    walletAddress: string,
  ): Promise<Array<{ tokenAddress: string; balance: bigint; decimals: bigint }>> {
    if (!ethers.isAddress(walletAddress)) {
      throw new BadRequestException(`Invalid wallet address: ${walletAddress}`);
    }

    const usdcAbi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const results: Array<{ tokenAddress: string; balance: bigint; decimals: bigint }> = [];
    for (const tokenAddress of this.USDC_CONTRACTS) {
      if (!ethers.isAddress(tokenAddress)) continue;

      // Skip if RPC points to the wrong chain or contract doesn't exist
      const code = await this.provider.getCode(tokenAddress);
      if (!code || code === '0x') continue;

      const contract = new ethers.Contract(tokenAddress, usdcAbi, this.provider);
      
      const [rawBalance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress) as Promise<bigint>,
        contract.decimals() as Promise<unknown>,
      ]);

      const dec =
        typeof decimals === 'bigint'
          ? decimals
          : typeof decimals === 'number'
            ? BigInt(decimals)
            : BigInt(String(decimals));

      results.push({ tokenAddress, balance: rawBalance, decimals: dec });
    }

    return results;
  }

  async getOrCreateTempWallet(userId: string): Promise<TempWallet> {
    // Check if user has an active temp wallet for Polygon
    const existingWallet = await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE, network: WalletNetwork.POLYGON },
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    // Encrypt private key before storing
    const encryptedPrivateKey = encrypt(privateKey);
    // Store the hash of the encryption key used, so we know which key to use for decryption
    const encryptionKeyHash = getEncryptionKeyHash();

    const tempWallet = this.tempWalletRepository.create({
      userId,
      address,
      privateKey: encryptedPrivateKey,
      encryptionKeyHash: encryptionKeyHash,
      network: WalletNetwork.POLYGON,
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }

  async getTempWallet(userId: string): Promise<TempWallet | null> {
    return await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE, network: WalletNetwork.POLYGON },
    });
  }

  async getDecryptedPrivateKey(tempWallet: TempWallet): Promise<string> {
    try {
      // Try to decrypt the private key using the stored encryption key hash
      return decrypt(tempWallet.privateKey, tempWallet.encryptionKeyHash);
    } catch (error) {
      // Check if the private key might be stored in plain text (for old wallets created before encryption)
      // Ethereum private keys are 66 hex characters (0x + 64 hex)
      const privateKeyPattern = /^0x[0-9a-fA-F]{64}$/;
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
      // Get USDC balance
      const balance = await this.getUSDCBalance(walletAddress);
      
      // Check if balance matches expected amount (within tolerance)
      if (Math.abs(balance - expectedAmount) <= tolerance) {
        // For Polygon, we need to check recent transactions to get the transaction hash
        // This is a simplified version - in production, you might want to use a service like Alchemy or Moralis
        // For now, we'll return success if balance matches
        return {
          success: true,
          amount: balance,
        };
      }

      return { success: false };
    } catch (error) {
      console.error('Error checking wallet payment:', error);
      return { success: false };
    }
  }

  async getMATICBalance(walletAddress: string): Promise<number> {
    try {
      const balance = await this.provider.getBalance(walletAddress);
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error getting MATIC balance:', error);
      return 0;
    }
  }

  async getUSDCBalance(walletAddress: string, retries: number = 3): Promise<number> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add delay for retries to avoid rate limiting
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        if (!ethers.isAddress(walletAddress)) {
          console.error(`Invalid wallet address for Polygon USDC balance: ${walletAddress}`);
          return 0;
        }

        const debug = String(process.env.POLYGON_WALLET_DEBUG || '').toLowerCase() === 'true';
        if (debug) {
          try {
            const net = await this.provider.getNetwork();
            console.log('[PolygonWalletService.getUSDCBalance] network', {
              chainId: net.chainId?.toString?.() ?? String(net.chainId),
              name: net.name,
            });
          } catch {
            // ignore debug network lookup failures
          }
          console.log('[PolygonWalletService.getUSDCBalance] walletAddress', walletAddress);
          console.log('[PolygonWalletService.getUSDCBalance] contracts', this.USDC_CONTRACTS);
        }

        const targetDecimals = 6n; // USDC is 6 decimals (native + bridged)
        let total: bigint = 0n;

        const balances = await this.getUSDCBalancesByContract(walletAddress);
        if (!balances.length) {
          throw new Error('Failed to query all configured Polygon USDC contracts (no successful responses)');
        }

        for (const b of balances) {
          let normalized = b.balance;
          if (b.decimals > targetDecimals) normalized = b.balance / 10n ** (b.decimals - targetDecimals);
          if (b.decimals < targetDecimals) normalized = b.balance * 10n ** (targetDecimals - b.decimals);
          total += normalized;
        }

        return parseFloat(ethers.formatUnits(total, Number(targetDecimals)));
      } catch (error) {
        if (attempt === retries - 1) {
          console.error('Error getting USDC balance:', error);
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
   * Get all incoming USDC transactions for a wallet address
   * Note: This is a simplified version. In production, use a service like Alchemy or Moralis for better transaction tracking
   */
  async getIncomingUSDCTransactions(
    walletAddress: string,
    limit: number = 50,
  ): Promise<Array<{ transactionHash: string; amount: number; timestamp: number; from: string }>> {
    try {
      // This is a placeholder - in production, you'd use a service like Alchemy, Moralis, or The Graph
      // to query USDC transfer events for this address
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error getting incoming USDC transactions:', error);
      return [];
    }
  }

  /**
   * Send MATIC from master wallet to a destination address
   */
  async sendMATIC(
    fromPrivateKey: string,
    toAddress: string,
    amountMATIC: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
      const amount = ethers.parseEther(amountMATIC.toString());

      const transaction = await wallet.sendTransaction({
        to: toAddress,
        value: amount,
      });

      const receipt = await transaction.wait();

      if (receipt && receipt.status === 1) {
        return {
          success: true,
          transactionHash: receipt.hash,
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed',
        };
      }
    } catch (error) {
      console.error('Error sending MATIC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send USDC (ERC20) from a wallet to a destination address
   */
  async sendUSDC(
    fromPrivateKey: string,
    toAddress: string,
    amountUSDC: number,
    tokenContractAddress?: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
      
      // USDC ERC20 ABI
      const usdcAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
      ];

      const tokenAddress = tokenContractAddress || this.getPrimaryUSDCContractAddress();
      const contract = new ethers.Contract(tokenAddress, usdcAbi, wallet);
      const decimalsRaw = await (contract.decimals() as Promise<unknown>);
      const decimals =
        typeof decimalsRaw === 'bigint'
          ? Number(decimalsRaw)
          : typeof decimalsRaw === 'number'
            ? decimalsRaw
            : Number(String(decimalsRaw));
      const amount = ethers.parseUnits(amountUSDC.toString(), decimals);

      const transaction = await contract.transfer(toAddress, amount);
      const receipt = await transaction.wait();

      if (receipt && receipt.status === 1) {
        return {
          success: true,
          transactionHash: receipt.hash,
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed',
        };
      }
    } catch (error) {
      console.error('Error sending USDC:', error);
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
    const masterWalletAddress = process.env.POLYGON_MASTER_WALLET_ADDRESS;
    const masterWalletPrivateKey = process.env.POLYGON_MASTER_WALLET_PRIVATE_KEY;

    if (!masterWalletAddress || !masterWalletPrivateKey) {
      throw new BadRequestException(
        'Master wallet not configured. Please set POLYGON_MASTER_WALLET_ADDRESS and POLYGON_MASTER_WALLET_PRIVATE_KEY environment variables.',
      );
    }

    return {
      address: masterWalletAddress,
      privateKey: masterWalletPrivateKey,
    };
  }

  /**
   * Transfer all USDC from temp wallet to master wallet
   * Also transfers remaining MATIC after USDC transfer
   */
  async transferFromTempWalletToMaster(
    tempWallet: TempWallet,
  ): Promise<{ success: boolean; usdcTxHash?: string; maticTxHash?: string; error?: string }> {
    try {
      const masterWallet = this.getMasterWallet();
      const privateKey = await this.getDecryptedPrivateKey(tempWallet);

      const result: { success: boolean; usdcTxHash?: string; maticTxHash?: string; error?: string } = {
        success: false,
      };

      // Transfer USDC (native and/or bridged) if present
      const usdcAbi = ['function transfer(address to, uint256 amount) returns (bool)'];
      const balances = await this.getUSDCBalancesByContract(tempWallet.address);
      const nonZero = balances.filter((b) => b.balance > 0n);

      if (!nonZero.length) {
        result.success = false;
        result.error = `No USDC to transfer.`;
        return result;
      }

      const signer = new ethers.Wallet(privateKey, this.provider);
      const txHashes: string[] = [];

      for (const b of nonZero) {
        const contract = new ethers.Contract(b.tokenAddress, usdcAbi, signer);
        const tx = await contract.transfer(masterWallet.address, b.balance);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          return { success: false, error: `USDC transfer failed for token ${b.tokenAddress}` };
        }
        txHashes.push(receipt.hash);
        // small delay to reduce nonce/rpc flakiness on some providers
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      result.usdcTxHash = txHashes.join(',');

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
   * Send MATIC from master wallet to temp wallet (for gas fees)
   */
  async sendMATICToTempWallet(
    tempWalletAddress: string,
    amountMATIC: number = 0.1,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const masterWallet = this.getMasterWallet();
      return await this.sendMATIC(masterWallet.privateKey, tempWalletAddress, amountMATIC);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

