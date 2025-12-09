import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempWallet, TempWalletStatus } from '../entities/temp-wallet.entity';
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
    // Check if user has an active temp wallet
    const existingWallet = await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE },
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Generate new wallet
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
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }

  async createTempWallet(userId: string): Promise<TempWallet> {
    // Always create a new temp wallet (for charges, we need a new wallet per charge)
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
      status: TempWalletStatus.ACTIVE,
      totalReceived: 0,
    });

    return await this.tempWalletRepository.save(tempWallet);
  }

  async getTempWallet(userId: string): Promise<TempWallet | null> {
    return await this.tempWalletRepository.findOne({
      where: { userId, status: TempWalletStatus.ACTIVE },
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


  async estimateGasFee(): Promise<number> {
    // TRX price in USDT (you can fetch this from an API or use a fixed rate)
    // For now, using a conservative estimate
    const trxPriceInUSDT = 0.1; // This should be fetched from an API
    const estimatedTRX = 15; // Conservative estimate for USDT transfer
    return estimatedTRX * trxPriceInUSDT;
  }

  async getTRXBalance(walletAddress: string): Promise<number> {
    try {
      const balance = await this.tronWeb.trx.getBalance(walletAddress);
      return balance / 1e6; // Convert from sun to TRX
    } catch (error) {
      console.error('Error getting TRX balance:', error);
      return 0;
    }
  }


  async getUSDTBalance(walletAddress: string): Promise<number> {
    try {
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

      // Fallback to contract call with default address
      return await this.getUSDTBalanceViaContract(walletAddress);
    } catch (error) {
      console.error('Error getting USDT balance via API, trying contract call:', error);
      // Fallback to contract call
      return await this.getUSDTBalanceViaContract(walletAddress);
    }
  }

  private async getUSDTBalanceViaContract(walletAddress: string): Promise<number> {
    try {
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
      console.error('Error getting USDT balance via contract:', error);
      return 0;
    }
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
   * Calculate the exact TRX amount needed for a USDT transfer
   * This uses triggerSmartContract to estimate energy before sending
   * Similar to how TronLink shows the exact fee before sending
   */
  async calculateRequiredTRXForTransfer(
    fromAddress: string,
    toAddress: string,
    usdtAmount: number,
    privateKey: string,
  ): Promise<number> {
    try {
      // Create TronWeb instance with the temp wallet
      const tempTronWeb = new TronWeb({
        fullHost: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
        solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
        eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
        privateKey: privateKey,
      });

      // Set the address for the contract call
      tempTronWeb.setAddress(fromAddress);

      // Check if recipient (master wallet) already has USDT
      // This affects energy requirement: ~65,000 if has USDT, ~130,000 if first time
      const recipientHasUSDT = await this.getUSDTBalance(toAddress) > 0;

      // Prepare the transfer function call
      const amountInSmallestUnit = Math.floor(usdtAmount * 1e6);
      
      // Get contract instance (we'll reuse it)
      const contract = await tempTronWeb.contract().at(this.USDT_CONTRACT);
      
      // Estimate energy consumption
      // For USDT transfers: ~65,000 energy if recipient has USDT, ~130,000 if first time
      // We check the recipient's USDT balance to determine this
      let estimatedEnergy = recipientHasUSDT ? 65000 : 130000;

      // Try to get more accurate energy estimate by simulating the transaction
      try {
        // Use triggerConstantContract to simulate (this doesn't cost anything)
        // This gives us the actual energy that would be consumed
        const functionSelector = 'transfer(address,uint256)';
        const parameter = [
          { type: 'address', value: toAddress },
          { type: 'uint256', value: amountInSmallestUnit },
        ];

        // Try to get energy estimate from the network
        try {
          // Method 1: Try triggerConstantContract (simulation)
          const constantResult = await tempTronWeb.transactionBuilder.triggerConstantContract(
            fromAddress,
            this.USDT_CONTRACT,
            functionSelector,
            {},
            parameter,
            fromAddress,
          );

          if (constantResult && constantResult.energy_used) {
            // Add 10% buffer for actual execution
            estimatedEnergy = Math.ceil(constantResult.energy_used * 1.1);
            console.log(`Got energy estimate from simulation: ${estimatedEnergy}`);
          }
        } catch (simError) {
          // If simulation fails, use the known values based on recipient status
          console.log(`Simulation not available, using known values: ${estimatedEnergy} (recipient has USDT: ${recipientHasUSDT})`);
        }
      } catch (error) {
        // If all estimation methods fail, use known values
        console.log(`Using fallback energy estimate: ${estimatedEnergy} (recipient has USDT: ${recipientHasUSDT})`);
      }

      // Get energy price from network (default is 420 sun per energy unit)
      let energyPrice = 420; // sun per energy unit
      try {
        const chainParams = await tempTronWeb.trx.getChainParameters();
        if (chainParams && Array.isArray(chainParams)) {
          const energyPriceParam = chainParams.find((p: any) => p.key === 'getEnergyFee');
          if (energyPriceParam && energyPriceParam.value) {
            energyPrice = Number(energyPriceParam.value);
          }
        }
      } catch (error) {
        console.warn('Could not fetch energy price, using default:', error);
      }

      // Calculate energy fee in sun
      const energyFeeInSun = estimatedEnergy * energyPrice;

      // Build transaction to get bandwidth requirement
      // Use transactionBuilder.triggerSmartContract to build without sending
      let txSize = 250; // Default size for TRC20 transfer
      try {
        const functionSelector = 'transfer(address,uint256)';
        const parameter = [
          { type: 'address', value: toAddress },
          { type: 'uint256', value: amountInSmallestUnit },
        ];

        // Build the transaction using triggerSmartContract (this doesn't send it)
        const transaction = await tempTronWeb.transactionBuilder.triggerSmartContract(
          this.USDT_CONTRACT,
          functionSelector,
          {},
          parameter,
          fromAddress,
        );

        if (transaction && transaction.transaction) {
          // Get transaction size in bytes for bandwidth calculation
          try {
            // Get size from raw_data
            if (transaction.transaction.raw_data) {
              const rawDataStr = JSON.stringify(transaction.transaction.raw_data);
              txSize = Buffer.byteLength(rawDataStr, 'utf8');
            } else if (transaction.transaction.raw_data_hex) {
              txSize = Buffer.from(transaction.transaction.raw_data_hex, 'hex').length;
            }
          } catch (error) {
            // If we can't get exact size, use fallback
            console.warn('Could not calculate exact transaction size:', error);
          }
        }
      } catch (error) {
        // Fallback to typical size if building transaction fails
        console.warn('Could not build transaction for size calculation, using fallback:', error);
        txSize = 250; // Typical size for TRC20 transfer
      }

      // Get bandwidth price (default is 1000 sun per byte)
      let bandwidthPrice = 1000; // sun per byte
      try {
        const chainParams = await tempTronWeb.trx.getChainParameters();
        if (chainParams && Array.isArray(chainParams)) {
          const bandwidthParam = chainParams.find((p: any) => p.key === 'getTransactionFee');
          if (bandwidthParam && bandwidthParam.value) {
            bandwidthPrice = Number(bandwidthParam.value);
          }
        }
      } catch (error) {
        console.warn('Could not fetch bandwidth price, using default:', error);
      }

      // Calculate bandwidth fee in sun
      const bandwidthFeeInSun = txSize * bandwidthPrice;

      // Total fee in sun (energy + bandwidth)
      const totalFeeInSun = energyFeeInSun + bandwidthFeeInSun;

      // Convert to TRX (1 TRX = 1,000,000 sun)
      const totalFeeInTRX = totalFeeInSun / 1e6;

      // Add a small safety buffer (5% or minimum 1 TRX)
      const safetyBuffer = Math.max(1, totalFeeInTRX * 0.05);
      const totalRequired = totalFeeInTRX + safetyBuffer;

      console.log(`Fee calculation: Energy=${estimatedEnergy} (${energyFeeInSun} sun), Bandwidth=${txSize} bytes (${bandwidthFeeInSun} sun), Total=${totalRequired.toFixed(4)} TRX`);

      // Round up to 4 decimal places
      return Math.ceil(totalRequired * 10000) / 10000;
    } catch (error) {
      console.error('Error calculating required TRX from transaction:', error);
      // Fallback to conservative estimate if calculation fails
      console.log('Falling back to conservative estimate');
      // Use higher estimate for safety (assuming recipient doesn't have USDT)
      return 30; // 30 TRX as a safe fallback
    }
  }

  /**
   * Get master wallet address and private key from environment
   */
  private getMasterWallet(): { address: string; privateKey: string } {
    const masterAddress = process.env.MASTER_WALLET_ADDRESS || 'TUKfsPy65pdtwZXeUUmVHQEELSk3CU9Qax';
    const masterPrivateKey = process.env.MASTER_WALLET_PRIVATE_KEY || 'c5532323738373617ed3744fddc6f65361878168ff6f28d9a5e06cb907085b65';

    if (!masterAddress || !masterPrivateKey) {
      throw new BadRequestException(
        'Master wallet not configured. Please set MASTER_WALLET_ADDRESS and MASTER_WALLET_PRIVATE_KEY environment variables.'
      );
    }

    return {
      address: masterAddress,
      privateKey: masterPrivateKey,
    };
  }

  /**
   * Send TRX from master wallet to temp wallet
   */
  private async sendTRXFromMaster(
    toAddress: string,
    amountInTRX: number,
  ): Promise<string> {
    try {
      const masterWallet = this.getMasterWallet();
      
      // Create TronWeb instance with master wallet private key
      const masterTronWeb = new TronWeb({
        fullHost: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
        solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
        eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
        privateKey: masterWallet.privateKey,
      });

      // Convert TRX to sun (1 TRX = 1,000,000 sun)
      const amountInSun = Math.floor(amountInTRX * 1e6);

      // Send TRX
      const transaction = await masterTronWeb.trx.sendTransaction(
        toAddress,
        amountInSun,
        masterWallet.privateKey
      );

      if (!transaction || !transaction.txid) {
        throw new BadRequestException('Failed to send TRX transaction');
      }

      // Wait for transaction to be confirmed
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 30 seconds

      while (!confirmed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const txInfo = await masterTronWeb.trx.getTransactionInfo(transaction.txid);
        if (txInfo && txInfo.receipt && txInfo.receipt.result === 'SUCCESS') {
          confirmed = true;
        }
        attempts++;
      }

      return transaction.txid;
    } catch (error) {
      console.error('Error sending TRX from master wallet:', error);
      throw new BadRequestException(
        `Failed to send TRX from master wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Transfer USDT from temp wallet to master wallet
   */
  async transferFromTempToMaster(
    tempWalletId: string,
  ): Promise<{
    usdtAmount: number;
    usdtTxHash: string;
    trxTxHash?: string;
  }> {
    try {
      // Get temp wallet
      const tempWallet = await this.tempWalletRepository.findOne({
        where: { id: tempWalletId },
      });

      if (!tempWallet) {
        throw new BadRequestException('Temp wallet not found');
      }

      // Get USDT balance
      const usdtBalance = await this.getUSDTBalance(tempWallet.address);
      
      // Get decrypted private key
      const privateKey = await this.getDecryptedPrivateKey(tempWallet);

      // Get master wallet address
      const masterWallet = this.getMasterWallet();

      // Get current TRX balance
      const currentTRXBalance = await this.getTRXBalance(tempWallet.address);

      // If no USDT, just transfer TRX and return
      if (usdtBalance <= 0) {
        console.log(`Temp wallet has no USDT, transferring TRX only (${currentTRXBalance.toFixed(4)} TRX)`);
        
        // TRX transfer fee is typically around 0.1-0.2 TRX, but we'll leave 0.5 TRX as buffer
        const trxTransferFeeBuffer = 0.5;
        
        // Only send if there's enough TRX left after accounting for transfer fee
        if (currentTRXBalance > trxTransferFeeBuffer) {
          // Calculate amount to send (leave buffer for transfer fee)
          const trxToSend = currentTRXBalance - trxTransferFeeBuffer;
          
          console.log(`Sending ${trxToSend.toFixed(4)} TRX from temp wallet to master wallet (leaving ${trxTransferFeeBuffer} TRX for fees)`);
          
          // Create TronWeb instance with temp wallet private key
          const tempTronWeb = new TronWeb({
            fullHost: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
            solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
            eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
            privateKey: privateKey,
          });

          // Send TRX from temp wallet to master wallet
          const trxAmountInSun = Math.floor(trxToSend * 1e6);
          
          const trxResult = await tempTronWeb.trx.sendTransaction(
            masterWallet.address,
            trxAmountInSun,
            privateKey
          );

          // Handle different result formats
          let trxTxHash: string | null = null;
          
          if (typeof trxResult === 'string') {
            trxTxHash = trxResult;
          } else if (trxResult && trxResult.txid) {
            trxTxHash = trxResult.txid;
          } else if (trxResult && trxResult.transaction && trxResult.transaction.txid) {
            trxTxHash = trxResult.transaction.txid;
          } else if (trxResult && trxResult.txID) {
            trxTxHash = trxResult.txID;
          }

          if (trxTxHash) {
            console.log(`TRX transfer transaction hash: ${trxTxHash}`);
            
            // Wait for TRX transfer to be confirmed
            let trxConfirmed = false;
            let trxAttempts = 0;
            const maxTrxAttempts = 30; // 30 seconds for TRX transfer

            while (!trxConfirmed && trxAttempts < maxTrxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              try {
                const trxTxInfo = await tempTronWeb.trx.getTransactionInfo(trxTxHash);
                if (trxTxInfo && trxTxInfo.receipt && trxTxInfo.receipt.result === 'SUCCESS') {
                  trxConfirmed = true;
                  console.log(`TRX transfer confirmed: ${trxTxHash}`);
                }
              } catch (error) {
                // Transaction might not be confirmed yet, continue waiting
              }
              trxAttempts++;
            }

            if (!trxConfirmed) {
              console.warn(`TRX transfer transaction ${trxTxHash} not confirmed within timeout, but transfer may have succeeded`);
            }

            return {
              usdtAmount: 0,
              usdtTxHash: '',
              trxTxHash: trxTxHash,
            };
          } else {
            throw new BadRequestException('Failed to get transaction hash from TRX transfer');
          }
        } else {
          console.log(`No significant TRX remaining in temp wallet (${currentTRXBalance.toFixed(4)} TRX), nothing to transfer`);
          return {
            usdtAmount: 0,
            usdtTxHash: '',
            trxTxHash: undefined,
          };
        }
      }

      // If USDT exists, proceed with USDT transfer
      // Calculate exact required TRX for the transfer by building the transaction first
      // This gives us the exact fee like TronLink does
      const requiredTRX = await this.calculateRequiredTRXForTransfer(
        tempWallet.address,
        masterWallet.address,
        usdtBalance,
        privateKey,
      );

      console.log(`Calculated required TRX for transfer: ${requiredTRX} TRX`);

      // Send TRX from master if needed
      let trxTxHash: string | undefined;
      if (currentTRXBalance < requiredTRX) {
        const trxNeeded = requiredTRX - currentTRXBalance;
        // Add a small buffer (1 TRX) for safety
        const trxWithBuffer = trxNeeded + 1;
        console.log(`Sending ${trxWithBuffer} TRX from master to temp wallet ${tempWallet.address} (needed: ${trxNeeded.toFixed(4)}, current: ${currentTRXBalance.toFixed(4)})`);
        trxTxHash = await this.sendTRXFromMaster(tempWallet.address, trxWithBuffer);
        
        // Wait a bit for TRX to be available
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        console.log(`Temp wallet has sufficient TRX: ${currentTRXBalance.toFixed(4)} >= ${requiredTRX.toFixed(4)}`);
      }

      // Create TronWeb instance with temp wallet private key
      const tempTronWeb = new TronWeb({
        fullHost: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
        solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
        eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
        privateKey: privateKey,
      });

      // Set the address for the contract call
      tempTronWeb.setAddress(tempWallet.address);

      // Get USDT contract
      const contract = await tempTronWeb.contract().at(this.USDT_CONTRACT);

      // Transfer USDT (amount in smallest unit, USDT has 6 decimals)
      const amountInSmallestUnit = Math.floor(usdtBalance * 1e6);
      
      console.log(`Transferring ${usdtBalance} USDT from ${tempWallet.address} to ${masterWallet.address}`);
      
      const result = await contract.transfer(
        masterWallet.address,
        amountInSmallestUnit
      ).send();

      // TronWeb contract.transfer().send() can return different formats:
      // - String (transaction hash directly)
      // - Object with txid property
      // - Object with transaction property containing txid
      let txHash: string | null = null;

      if (typeof result === 'string') {
        // Result is the transaction hash directly
        txHash = result;
      } else if (result && result.txid) {
        // Result has txid property
        txHash = result.txid;
      } else if (result && result.transaction && result.transaction.txid) {
        // Result has transaction object with txid
        txHash = result.transaction.txid;
      } else if (result && result.txID) {
        // Alternative property name
        txHash = result.txID;
      } else {
        // Log the actual result structure for debugging
        console.error('Unexpected result format from contract.transfer().send():', JSON.stringify(result, null, 2));
        throw new BadRequestException('Failed to get transaction hash from transfer result');
      }

      if (!txHash) {
        throw new BadRequestException('Failed to transfer USDT: No transaction hash returned');
      }

      console.log(`USDT transfer transaction hash: ${txHash}`);

      // Wait for transaction to be confirmed
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 60 seconds for USDT transfer

      while (!confirmed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const txInfo = await tempTronWeb.trx.getTransactionInfo(txHash);
          if (txInfo && txInfo.receipt && txInfo.receipt.result === 'SUCCESS') {
            confirmed = true;
            console.log(`USDT transfer confirmed: ${txHash}`);
          }
        } catch (error) {
          // Transaction might not be confirmed yet, continue waiting
        }
        attempts++;
      }

      if (!confirmed) {
        // Even if not confirmed, if the transfer happened, we should still return success
        // The transaction might be pending but will confirm eventually
        console.warn(`USDT transfer transaction ${txHash} not confirmed within timeout, but transfer may have succeeded`);
        // Don't throw error - the transfer likely succeeded
      }

      // After USDT transfer, send remaining TRX from temp wallet to master wallet
      let remainingTrxTxHash: string | undefined = undefined;
      try {
        // Wait a bit for the USDT transaction to settle
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Get remaining TRX balance in temp wallet
        const remainingTRXBalance = await this.getTRXBalance(tempWallet.address);
        
        // TRX transfer fee is typically around 0.1-0.2 TRX, but we'll leave 0.5 TRX as buffer
        const trxTransferFeeBuffer = 0.5;
        
        // Only send if there's enough TRX left after accounting for transfer fee
        if (remainingTRXBalance > trxTransferFeeBuffer) {
          // Calculate amount to send (leave buffer for transfer fee)
          const trxToSend = remainingTRXBalance - trxTransferFeeBuffer;
          
          console.log(`Sending remaining ${trxToSend.toFixed(4)} TRX from temp wallet to master wallet (leaving ${trxTransferFeeBuffer} TRX for fees)`);
          
          // Send TRX from temp wallet to master wallet
          const trxAmountInSun = Math.floor(trxToSend * 1e6);
          
          const trxResult = await tempTronWeb.trx.sendTransaction(
            masterWallet.address,
            trxAmountInSun,
            privateKey
          );

          // Handle different result formats (similar to USDT transfer)
          let trxTxHash: string | null = null;
          
          if (typeof trxResult === 'string') {
            trxTxHash = trxResult;
          } else if (trxResult && trxResult.txid) {
            trxTxHash = trxResult.txid;
          } else if (trxResult && trxResult.transaction && trxResult.transaction.txid) {
            trxTxHash = trxResult.transaction.txid;
          } else if (trxResult && trxResult.txID) {
            trxTxHash = trxResult.txID;
          }

          if (trxTxHash) {
            remainingTrxTxHash = trxTxHash;
            console.log(`TRX transfer transaction hash: ${remainingTrxTxHash}`);
            
            // Wait for TRX transfer to be confirmed (shorter timeout since it's simpler)
            let trxConfirmed = false;
            let trxAttempts = 0;
            const maxTrxAttempts = 30; // 30 seconds for TRX transfer

            while (!trxConfirmed && trxAttempts < maxTrxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              try {
                const trxTxInfo = await tempTronWeb.trx.getTransactionInfo(remainingTrxTxHash);
                if (trxTxInfo && trxTxInfo.receipt && trxTxInfo.receipt.result === 'SUCCESS') {
                  trxConfirmed = true;
                  console.log(`TRX transfer confirmed: ${remainingTrxTxHash}`);
                }
              } catch (error) {
                // Transaction might not be confirmed yet, continue waiting
              }
              trxAttempts++;
            }

            if (!trxConfirmed) {
              console.warn(`TRX transfer transaction ${remainingTrxTxHash} not confirmed within timeout, but transfer may have succeeded`);
            }
          } else {
            console.warn('Failed to get transaction hash from TRX transfer, but transfer may have succeeded');
          }
        } else {
          console.log(`No significant TRX remaining in temp wallet (${remainingTRXBalance.toFixed(4)} TRX), skipping TRX transfer`);
        }
      } catch (error) {
        // Don't fail the whole operation if TRX transfer fails
        // Log the error but continue
        console.error('Error sending remaining TRX to master wallet:', error);
        console.warn('Continuing despite TRX transfer error - USDT transfer was successful');
      }

      return {
        usdtAmount: usdtBalance,
        usdtTxHash: txHash,
        trxTxHash: trxTxHash || remainingTrxTxHash, // Use the TRX sent from master, or the remaining TRX transfer
      };
    } catch (error) {
      console.error('Error transferring from temp to master:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to transfer from temp wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

