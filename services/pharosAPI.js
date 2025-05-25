const axios = require('axios');
const { ethers } = require('ethers');
const logger = require('../utils/logger');

class PharosAPI {
    constructor() {
        this.baseURL = process.env.PHAROS_API_BASE;
        this.rpcURL = process.env.PHAROS_RPC_URL;
        this.chainId = parseInt(process.env.PHAROS_CHAIN_ID);
        this.maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
        this.delayBetweenTasks = parseInt(process.env.DELAY_BETWEEN_TASKS) || 2000;
    }

    // Buat provider dengan retry logic
    createProvider() {
        return new ethers.JsonRpcProvider(this.rpcURL);
    }

    // Buat wallet dari private key
    createWallet(privateKey, proxy = null) {
        try {
            const provider = this.createProvider();
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Setup proxy jika ada
            if (proxy) {
                // Implementasi proxy untuk axios requests
                this.setupProxy(proxy);
            }

            return wallet;
        } catch (error) {
            throw new Error(`Gagal membuat wallet: ${error.message}`);
        }
    }

    // Setup proxy untuk requests
    setupProxy(proxy) {
        const [host, port, username, password] = proxy.split(':');
        this.axiosConfig = {
            proxy: {
                host,
                port: parseInt(port),
                auth: username && password ? { username, password } : undefined
            }
        };
    }

    // Wrapper untuk HTTP requests dengan retry
    async makeRequest(method, url, data = null, retries = 0) {
        try {
            const config = {
                method,
                url: `${this.baseURL}${url}`,
                timeout: 30000,
                ...this.axiosConfig
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (retries < this.maxRetries) {
                logger.warn(`Request gagal, retry ${retries + 1}/${this.maxRetries}: ${error.message}`);
                await this.delay(2000 * (retries + 1)); // Exponential backoff
                return this.makeRequest(method, url, data, retries + 1);
            }
            throw error;
        }
    }

    // Daily check-in
    async dailyCheckIn(wallet) {
        try {
            const address = wallet.address;
            logger.info('Melakukan daily check-in...', address);

            // Buat signature untuk autentikasi
            const message = `Daily check-in for ${address} at ${Date.now()}`;
            const signature = await wallet.signMessage(message);

            const response = await this.makeRequest('POST', '/checkin', {
                address,
                message,
                signature,
                timestamp: Date.now()
            });

            if (response.success) {
                logger.success('Daily check-in berhasil', address);
                return response;
            } else {
                throw new Error(response.message || 'Check-in gagal');
            }
        } catch (error) {
            logger.error('Daily check-in gagal', wallet.address, error);
            throw error;
        }
    }

    // Klaim faucet
    async claimFaucet(wallet, tokenType = 'native') {
        try {
            const address = wallet.address;
            logger.info(`Mengklaim faucet ${tokenType}...`, address);

            const message = `Claim faucet ${tokenType} for ${address} at ${Date.now()}`;
            const signature = await wallet.signMessage(message);

            const response = await this.makeRequest('POST', '/faucet/claim', {
                address,
                tokenType,
                message,
                signature,
                timestamp: Date.now()
            });

            if (response.success) {
                logger.success(`Faucet ${tokenType} berhasil diklaim`, address);
                return response;
            } else {
                throw new Error(response.message || 'Klaim faucet gagal');
            }
        } catch (error) {
            logger.error(`Klaim faucet ${tokenType} gagal`, wallet.address, error);
            throw error;
        }
    }

    // Social tasks
    async completeSocialTask(wallet, taskType, taskData) {
        try {
            const address = wallet.address;
            logger.info(`Menyelesaikan social task: ${taskType}...`, address);

            const message = `Complete ${taskType} for ${address} at ${Date.now()}`;
            const signature = await wallet.signMessage(message);

            const response = await this.makeRequest('POST', '/social/complete', {
                address,
                taskType,
                taskData,
                message,
                signature,
                timestamp: Date.now()
            });

            if (response.success) {
                logger.success(`Social task ${taskType} berhasil diselesaikan`, address);
                return response;
            } else {
                throw new Error(response.message || 'Social task gagal');
            }
        } catch (error) {
            logger.error(`Social task ${taskType} gagal`, wallet.address, error);
            throw error;
        }
    }

    // Transfer token
    async transferToken(wallet, toAddress, amount, tokenAddress = null) {
        try {
            const address = wallet.address;
            logger.info(`Transfer ${amount} token ke ${toAddress}...`, address);

            let tx;
            if (tokenAddress) {
                // ERC20 transfer
                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    ['function transfer(address to, uint256 amount) returns (bool)'],
                    wallet
                );
                tx = await tokenContract.transfer(toAddress, ethers.parseEther(amount.toString()));
            } else {
                // Native token transfer
                tx = await wallet.sendTransaction({
                    to: toAddress,
                    value: ethers.parseEther(amount.toString()),
                    gasLimit: 21000
                });
            }

            const receipt = await tx.wait();
            logger.success(`Transfer berhasil, tx: ${receipt.hash}`, address);
            return receipt;
        } catch (error) {
            logger.error('Transfer gagal', wallet.address, error);
            throw error;
        }
    }

    // Delay helper
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cek balance
    async getBalance(wallet, tokenAddress = null) {
        try {
            if (tokenAddress) {
                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    ['function balanceOf(address) view returns (uint256)'],
                    wallet
                );
                const balance = await tokenContract.balanceOf(wallet.address);
                return ethers.formatEther(balance);
            } else {
                const balance = await wallet.provider.getBalance(wallet.address);
                return ethers.formatEther(balance);
            }
        } catch (error) {
            logger.error('Gagal mendapatkan balance', wallet.address, error);
            return '0';
        }
    }
}

module.exports = PharosAPI;
