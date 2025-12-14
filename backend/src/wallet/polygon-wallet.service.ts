import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempWallet, TempWalletStatus, WalletNetwork } from '../entities/temp-wallet.entity';
import { encrypt, decrypt, getEncryptionKeyHash } from '../utils/encryption.util';
import { ethers } from 'ethers';

@Injectable()
export class PolygonWalletService {
  private provider: ethers.JsonRpcProvider;
  private readonly USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC Polygon contract address
  private readonly POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

  constructor(
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
  ) {
    // Initialize Polygon provider
    this.provider = new ethers.JsonRpcProvider(this.POLYGON_RPC_URL);
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

        // USDC ERC20 ABI (simplified - just balanceOf)
        const usdcAbi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function decimals() view returns (uint8)',
        ];

        const contract = new ethers.Contract(this.USDC_CONTRACT, usdcAbi, this.provider);
        const balance = await contract.balanceOf(walletAddress);
        const decimals = await contract.decimals();
        
        // USDC has 6 decimals
        return parseFloat(ethers.formatUnits(balance, decimals));
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
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
      
      // USDC ERC20 ABI
      const usdcAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
      ];

      const contract = new ethers.Contract(this.USDC_CONTRACT, usdcAbi, wallet);
      const decimals = await contract.decimals();
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

      // Get current balances
      const usdcBalance = await this.getUSDCBalance(tempWallet.address);

      const result: { success: boolean; usdcTxHash?: string; maticTxHash?: string; error?: string } = {
        success: false,
      };

      // Transfer USDC if balance > 0
      console.log('usdcBalance', usdcBalance);
      if (usdcBalance > 0.000001) {
        const usdcResult = await this.sendUSDC(privateKey, masterWallet.address, usdcBalance);
        if (!usdcResult.success) {
          return {
            success: false,
            error: `Failed to transfer USDC: ${usdcResult.error}`,
          };
        }
        result.usdcTxHash = usdcResult.transactionHash;

        // Wait a bit for transaction to be processed
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        result.success = false;
        result.error = `No USDC to transfer.`;
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

