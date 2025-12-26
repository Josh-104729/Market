import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ethers, formatUnits, parseUnits } from 'ethers';
import { Repository } from 'typeorm';
import { TempWallet, TempWalletStatus, WalletNetwork } from '../entities/temp-wallet.entity';
import { decrypt, encrypt, getEncryptionKeyHash } from '../utils/encryption.util';

@Injectable()
export class PolygonWalletService {
  private polygonProvider?: ethers.JsonRpcProvider;

  constructor(
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
  ) {}

  private getPolygonRpcUrl(): string {
    const rpcUrl = process.env.POLYGON_RPC_URL;
    if (!rpcUrl) {
      throw new BadRequestException('Polygon RPC not configured. Please set POLYGON_RPC_URL.');
    }
    return rpcUrl;
  }

  private getPolygonProvider(): ethers.JsonRpcProvider {
    if (!this.polygonProvider) {
      this.polygonProvider = new ethers.JsonRpcProvider(this.getPolygonRpcUrl());
    }
    return this.polygonProvider;
  }

  private getPolygonUsdcAddress(): string {
    // Mainnet USDC on Polygon (6 decimals)
    // https://polygonscan.com/token/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
    return (
      process.env.POLYGON_USDC_CONTRACT_ADDRESS
    );
  }

  private getPolygonUsdcContract(signerOrProvider: ethers.Signer | ethers.Provider) {
    const usdcAbi = [
      'function balanceOf(address account) view returns (uint256)',
      'function transfer(address recipient, uint256 amount) public returns (bool)',
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ];
    return new ethers.Contract(this.getPolygonUsdcAddress(), usdcAbi, signerOrProvider);
  }

  async createTempWallet(userId: string): Promise<TempWallet> {
    // Ensure RPC is configured (early failure is nicer than later runtime errors)
    this.getPolygonProvider();

    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    const encryptedPrivateKey = encrypt(privateKey);
    const encryptionKeyHash = getEncryptionKeyHash();

    const tempWallet = this.tempWalletRepository.create({
      userId,
      address,
      privateKey: encryptedPrivateKey,
      encryptionKeyHash,
      network: WalletNetwork.POLYGON,
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }

  async getDecryptedPrivateKey(tempWallet: TempWallet): Promise<string> {
    try {
      return decrypt(tempWallet.privateKey, tempWallet.encryptionKeyHash);
    } catch (error) {
      // Polygon private keys can be stored as 0x + 64 hex chars (ethers) or without 0x.
      const privateKeyPattern = /^(0x)?[0-9a-fA-F]{64}$/;
      if (privateKeyPattern.test(tempWallet.privateKey)) {
        return tempWallet.privateKey.startsWith('0x') ? tempWallet.privateKey : `0x${tempWallet.privateKey}`;
      }

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
          `Original error: ${errorMessage}`,
      );
    }
  }

  async getMATICBalance(walletAddress: string): Promise<number> {
    try {
      const provider = this.getPolygonProvider();
      const balance = await provider.getBalance(walletAddress);
      console.log('MATIC balance', balance);
      console.log('formatUnits', formatUnits(balance, 18));
      return Number(formatUnits(balance, 18));
    } catch (error) {
      console.error('Error getting MATIC balance:', error);
      return 0;
    }
  }

  async getUSDCBalance(walletAddress: string): Promise<number> {
    try {
      console.log('getUSDCBalance', walletAddress);
      const provider = this.getPolygonProvider();
      const usdc = this.getPolygonUsdcContract(provider);
      const balance: bigint = await usdc.balanceOf(walletAddress);
      console.log('balance', balance);
      console.log('formatUnits', formatUnits(balance, 6));
      return Number(formatUnits(balance, 6));
    } catch (error) {
      console.error('Error getting USDC balance:', error);
      return 0;
    }
  }

  /**
   * Send USDC from an EOA private key to destination address.
   */
  async sendUSDC(
    fromPrivateKey: string,
    toAddress: string,
    amountUSDC: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!ethers.isAddress(toAddress)) {
        return { success: false, error: 'Invalid Polygon address' };
      }
      const provider = this.getPolygonProvider();
      const wallet = new ethers.Wallet(fromPrivateKey, provider);
      const usdc = this.getPolygonUsdcContract(wallet);

      const amount = parseUnits(amountUSDC.toString(), 6);

      const feeData = await provider.getFeeData();
      const overrides: any = {};
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        overrides.maxFeePerGas = feeData.maxFeePerGas * 2n;
        overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas * 2n;
      }

      try {
        const gasLimit: bigint = await usdc.transfer.estimateGas(toAddress, amount);
        overrides.gasLimit = (gasLimit * 12n) / 10n; // +20% buffer
      } catch {
        // fallback: let provider estimate
      }

      const tx = await usdc.transfer(toAddress, amount, overrides);
      const receipt = await provider.waitForTransaction(tx.hash);
      if (receipt?.status === 1) {
        return { success: true, transactionHash: tx.hash };
      }
      return { success: false, transactionHash: tx.hash, error: 'USDC transfer failed' };
    } catch (error) {
      console.error('Error sending USDC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendMATIC(
    fromPrivateKey: string,
    toAddress: string,
    amountMatic: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!ethers.isAddress(toAddress)) {
        return { success: false, error: 'Invalid Polygon address' };
      }
      const provider = this.getPolygonProvider();
      const wallet = new ethers.Wallet(fromPrivateKey, provider);

      const feeData = await provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas * 2n : undefined;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 2n : undefined;

      const value = parseUnits(amountMatic.toString(), 18);
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value,
        ...(maxFeePerGas && maxPriorityFeePerGas ? { maxFeePerGas, maxPriorityFeePerGas } : {}),
      });
      const receipt = await provider.waitForTransaction(tx.hash);
      if (receipt?.status === 1) {
        return { success: true, transactionHash: tx.hash };
      }
      return { success: false, transactionHash: tx.hash, error: 'MATIC transfer failed' };
    } catch (error) {
      console.error('Error sending MATIC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getPolygonMasterWallet(): { address: string; privateKey: string } {
    const masterWalletAddress = process.env.POLYGON_MASTER_WALLET_ADDRESS;
    const masterWalletPrivateKey = process.env.POLYGON_MASTER_WALLET_PRIVATE_KEY;

    if (!masterWalletAddress || !masterWalletPrivateKey) {
      throw new BadRequestException(
        'Polygon master wallet not configured. Please set POLYGON_MASTER_WALLET_ADDRESS and POLYGON_MASTER_WALLET_PRIVATE_KEY environment variables.',
      );
    }

    return { address: masterWalletAddress, privateKey: masterWalletPrivateKey };
  }

  /**
   * Transfer all USDC from Polygon temp wallet to Polygon master wallet.
   * If temp wallet lacks gas, master wallet can top it up with a small amount of MATIC.
   */
  async transferUSDCFromTempWalletToMaster(
    tempWallet: TempWallet,
  ): Promise<{ success: boolean; usdcTxHash?: string; maticTxHash?: string; error?: string }> {
    try {
      const masterWallet = this.getPolygonMasterWallet();
      const privateKey = await this.getDecryptedPrivateKey(tempWallet);

      const provider = this.getPolygonProvider();
      const tempEoa = new ethers.Wallet(privateKey, provider);
      const usdc = this.getPolygonUsdcContract(tempEoa);

      const rawBalance: bigint = await usdc.balanceOf(tempWallet.address);
      if (rawBalance <= 0n) {
        return { success: false, error: 'No USDC to transfer.' };
      }

      // Estimate if we need gas topup
      let gasNeededWei = 0n;
      const overrides: any = {};
      try {
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          overrides.maxFeePerGas = feeData.maxFeePerGas * 2n;
          overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas * 2n;
        }
        const gasLimit: bigint = await usdc.transfer.estimateGas(masterWallet.address, rawBalance);
        overrides.gasLimit = (gasLimit * 12n) / 10n;
        const price = (overrides.maxFeePerGas as bigint | undefined) || feeData.gasPrice || 0n;
        gasNeededWei = gasLimit * price;
      } catch {
        // If estimation fails, fall back to a small fixed topup threshold below.
      }

      const tempMatic = await provider.getBalance(tempWallet.address);
      const minTopup = Number(process.env.POLYGON_TEMP_WALLET_GAS_TOPUP_MATIC || 0.05);
      const reserveWei = parseUnits(String(minTopup), 18);

      let maticTxHash: string | undefined;
      const needTopup = gasNeededWei > 0n ? tempMatic < gasNeededWei : tempMatic < reserveWei;
      if (needTopup) {
        const topupRes = await this.sendMATIC(masterWallet.privateKey, tempWallet.address, minTopup);
        if (!topupRes.success) {
          return { success: false, error: `Failed to top up MATIC for gas: ${topupRes.error}` };
        }
        maticTxHash = topupRes.transactionHash;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      const tx = await usdc.transfer(masterWallet.address, rawBalance, overrides);
      const receipt = await provider.waitForTransaction(tx.hash);
      if (receipt?.status !== 1) {
        return { success: false, error: 'USDC transfer failed', maticTxHash };
      }

      return { success: true, usdcTxHash: tx.hash, maticTxHash };
    } catch (error) {
      console.error('Error transferring USDC from Polygon temp wallet to master:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}


