import { Injectable, BadRequestException, Logger } from '@nestjs/common';
const TronWebLib = require('tronweb');

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private tronWeb: any;
  private readonly USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20 mainnet

  constructor() {
    // Initialize TronWeb - using mainnet
    // TronWeb class is at TronWebLib.TronWeb
    const TronWeb = TronWebLib.TronWeb || TronWebLib.default?.TronWeb || TronWebLib;
    this.tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
    });
  }

  /**
   * Generate a new Tron wallet
   */
  async generateWallet(): Promise<{ address: string; privateKey: string }> {
    try {
      const account = await this.tronWeb.createAccount();
      return {
        address: account.address.base58,
        privateKey: account.privateKey,
      };
    } catch (error) {
      this.logger.error('Error generating wallet:', error);
      throw new BadRequestException('Failed to generate wallet');
    }
  }

  /**
   * Get USDT balance for a wallet address
   */
  async getUSDTBalance(address: string): Promise<number> {
    try {
      // Set the address we're querying as the default address for read-only contract calls
      // This is required by TronWeb for contract method calls
      this.tronWeb.setAddress(address);
      
      const contract = await this.tronWeb.contract().at(this.USDT_CONTRACT_ADDRESS);
      const balance = await contract.balanceOf(address).call();
      
      // Convert BigNumber/bigint to number properly
      // TronWeb returns balance as bigint
      if (typeof balance === 'bigint') {
        return Number(balance) / 1000000;
      } else if (balance && typeof balance.toNumber === 'function') {
        return balance.toNumber() / 1000000;
      } else if (balance && typeof balance.dividedBy === 'function') {
        return balance.dividedBy(1000000).toNumber();
      } else if (balance && typeof balance.toString === 'function') {
        // If it's a string representation of a number
        const numValue = parseFloat(balance.toString());
        return isNaN(numValue) ? 0 : numValue / 1000000;
      } else {
        const numValue = Number(balance);
        return isNaN(numValue) ? 0 : numValue / 1000000;
      }
    } catch (error) {
      this.logger.error(`Error getting USDT balance for ${address}:`, error);
      throw new BadRequestException(`Failed to get USDT balance: ${error.message}`);
    }
  }

  /**
   * Transfer USDT from one address to another
   * @param fromPrivateKey Private key of sender
   * @param toAddress Recipient address
   * @param amount Amount in USDT (will be converted to smallest unit)
   * @returns Transaction hash
   */
  async transferUSDT(
    fromPrivateKey: string,
    toAddress: string,
    amount: number,
  ): Promise<string> {
    try {
      // Set the private key for the sender
      this.tronWeb.setPrivateKey(fromPrivateKey);

      // Get the contract instance
      const contract = await this.tronWeb.contract().at(this.USDT_CONTRACT_ADDRESS);

      // Convert amount to smallest unit (USDT TRC20 has 6 decimals)
      // Use string to avoid precision issues
      const amountInSmallestUnit = this.tronWeb.toBigNumber((amount * 1000000).toString());

      // Transfer
      const tx = await contract.transfer(toAddress, amountInSmallestUnit).send();

      this.logger.log(`USDT transfer initiated: ${tx}`);
      return tx;
    } catch (error) {
      this.logger.error('Error transferring USDT:', error);
      throw new BadRequestException(`Failed to transfer USDT: ${error.message}`);
    }
  }

  /**
   * Verify a transaction by hash
   */
  async verifyTransaction(txHash: string): Promise<{
    confirmed: boolean;
    success: boolean;
    blockNumber?: number;
  }> {
    try {
      const tx = await this.tronWeb.trx.getTransaction(txHash);
      
      if (!tx) {
        return { confirmed: false, success: false };
      }

      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
      
      if (!txInfo) {
        return { confirmed: false, success: false };
      }

      return {
        confirmed: true,
        success: txInfo.receipt && txInfo.receipt.result === 'SUCCESS',
        blockNumber: txInfo.blockNumber,
      };
    } catch (error) {
      this.logger.error(`Error verifying transaction ${txHash}:`, error);
      return { confirmed: false, success: false };
    }
  }

  /**
   * Check if an address is valid Tron address
   */
  isValidAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }

  /**
   * Convert address to hex format
   */
  addressToHex(address: string): string {
    return this.tronWeb.address.toHex(address);
  }
}

