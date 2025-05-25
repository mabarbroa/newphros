const chalk = require('chalk');
const SecurityManager = require('./config/security');
const PharosAPI = require('./services/pharosAPI');
const logger = require('./utils/logger');
require('dotenv').config();

class PharosBot {
    constructor() {
        this.security = new SecurityManager();
        this.api = new PharosAPI();
        this.accounts = [];
        this.isRunning = false;
    }

    // Inisialisasi bot
    async initialize() {
        try {
            console.log(chalk.cyan('🚀 Memulai Pharos Bot Secure v2.0...'));
            
            // Load accounts
            this.accounts = await this.security.loadAccounts();
            
            if (this.accounts.length === 0) {
                console.log(chalk.yellow('⚠️  Tidak ada accounts ditemukan. Jalankan setup terlebih dahulu.'));
                await this.setupAccounts();
            }

            logger.info(`Bot diinisialisasi dengan ${this.accounts.length} accounts`);
            console.log(chalk.green(`✅ Bot siap dengan ${this.accounts.length} accounts`));
        } catch (error) {
            logger.error('Gagal inisialisasi bot', null, error);
            process.exit(1);
        }
    }

    // Setup accounts baru
    async setupAccounts() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => rl.question(query, resolve));

        try {
            console.log(chalk.yellow('\n📝 Setup Accounts Baru'));
            console.log(chalk.gray('Masukkan private key satu per satu. Ketik "done" untuk selesai.\n'));

            const accounts = [];
            let index = 1;

            while (true) {
                const privateKey = await question(`Account ${index} - Private Key (atau "done"): `);
                
                if (privateKey.toLowerCase() === 'done') {
                    break;
                }

                try {
                    // Validasi private key
                    const validKey = this.security.validatePrivateKey(privateKey);
                    const wallet = this.api.createWallet(validKey);
                    
                    // Opsional: proxy
                    const proxy = await question(`Account ${index} - Proxy (opsional, format host:port:user:pass): `);
                    
                    accounts.push({
                        privateKey: validKey,
                        address: wallet.address,
                        proxy: proxy.trim() || null
                    });

                    console.log(chalk.green(`✅ Account ${index} ditambahkan: ${wallet.address}`));
                    index++;
                } catch (error) {
                    console.log(chalk.red(`❌ Private key tidak valid: ${error.message}`));
                }
            }

            if (accounts.length > 0) {
                await this.security.saveAccounts(accounts);
                this.accounts = accounts;
                console.log(chalk.green(`\n✅ ${accounts.length} accounts berhasil disimpan dengan enkripsi`));
            } else {
                console.log(chalk.yellow('⚠️  Tidak ada accounts yang ditambahkan'));
            }
        } catch (error) {
            logger.error('Setup accounts gagal', null, error);
        } finally {
            rl.close();
        }
    }

    // Jalankan tugas untuk satu account
    async runAccountTasks(account) {
        try {
            const wallet = this.api.createWallet(account.privateKey, account.proxy);
            const address = wallet.address;

            logger.info('Memulai tugas untuk account', address);

            // 1. Daily Check-in
            try {
                await this.api.dailyCheckIn(wallet);
                await this.api.delay(this.api.delayBetweenTasks);
            } catch (error) {
                logger.warn('Daily check-in sudah dilakukan atau gagal', address);
            }

            // 2. Klaim Faucet Native
            try {
                await this.api.claimFaucet(wallet, 'native');
                await this.api.delay(this.api.delayBetweenTasks);
            } catch (error) {
                logger.warn('Klaim faucet native gagal atau sudah diklaim', address);
            }

            // 3. Klaim Faucet USDC
            try {
                await this.api.claimFaucet(wallet, 'USDC');
                await this.api.delay(this.api.delayBetweenTasks);
            } catch (error) {
                logger.warn('Klaim faucet USDC gagal atau sudah diklaim', address);
            }

            // 4. Social Tasks (contoh)
            const socialTasks = [
                { type: 'follow_twitter', data: { username: 'pharos_network' } },
                { type: 'join_discord', data: { invite: 'pharos-discord' } }
            ];

            for (const task of socialTasks) {
                try {
                    await this.api.completeSocialTask(wallet, task.type, task.data);
                    await this.api.delay(this.api.delayBetweenTasks);
                } catch (error) {
                    logger.warn(`Social task ${task.type} gagal atau sudah diselesaikan`, address);
                }
            }

            // 5. Self Transfer (untuk aktivitas on-chain)
            try {
                const balance = await this.api.getBalance(wallet);
                if (parseFloat(balance) > 0.001) {
                    await this.api.transferToken(wallet, address, 0.0001);
                }
            } catch (error) {
                logger.warn('Self transfer gagal', address);
            }

            logger.success('Semua tugas selesai untuk account', address);
        } catch (error) {
            logger.error('Tugas account gagal', account.address, error);
        }
    }

    // Jalankan bot untuk semua accounts
    async run() {
        if (this.isRunning) {
            logger.warn('Bot sudah berjalan');
            return;
        }

        this.isRunning = true;
        logger.info('🚀 Memulai bot untuk semua accounts...');

        try {
            for (let i = 0; i < this.accounts.length; i++) {
                const account = this.accounts[i];
                
                logger.info(`Memproses account ${i + 1}/${this.accounts.length}`, account.address);
                await this.runAccountTasks(account);
                
                // Delay antar account
                if (i < this.accounts.length - 1) {
                    const delay = parseInt(process.env.DELAY_BETWEEN_ACCOUNTS) || 5000;
                    logger.info(`Menunggu ${delay/1000} detik sebelum account berikutnya...`);
                    await this.api.delay(delay);
                }
            }

            logger.success('✅ Semua accounts selesai diproses');
        } catch (error) {
            logger.error('Bot run gagal', null, error);
        } finally {
            this.isRunning = false;
        }
    }

    // Jalankan bot dalam mode loop
    async runLoop() {
        const runInterval = 24 * 60 * 60 * 1000; // 24 jam
        
        while (true) {
            await this.run();
            
            logger.info(`Menunggu ${runInterval/1000/60/60} jam untuk run berikutnya...`);
            await this.api.delay(runInterval);
        }
    }

    // Menu interaktif
    async showMenu() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => rl.question(query, resolve));

        while (true) {
            console.log(chalk.cyan('\n🤖 Pharos Bot Secure v2.0'));
            console.log(chalk.gray('================================'));
            console.log('1. Jalankan bot sekali');
            console.log('2. Jalankan bot loop (24 jam)');
            console.log('3. Setup accounts baru');
            console.log('4. Lihat status accounts');
            console.log('5. Keluar');
            console.log(chalk.gray('================================'));

            const choice = await question('Pilih opsi (1-5): ');

            switch (choice) {
                case '1':
                    await this.run();
                    break;
                case '2':
                    console.log(chalk.yellow('⚠️  Bot akan berjalan terus menerus. Tekan Ctrl+C untuk berhenti.'));
                    await this.runLoop();
                    break;
                case '3':
                    await this.setupAccounts();
                    break;
                case '4':
                    await this.showAccountStatus();
                    break;
                case '5':
                    console.log(chalk.green('👋 Sampai jumpa!'));
                    rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log(chalk.red('❌ Pilihan tidak valid'));
            }
        }
    }

    // Tampilkan status accounts
    async showAccountStatus() {
        console.log(chalk.cyan('\n📊 Status Accounts'));
        console.log(chalk.gray('=================='));

        for (let i = 0; i < this.accounts.length; i++) {
            const account = this.accounts[i];
            try {
                const wallet = this.api.createWallet(account.privateKey, account.proxy);
                const balance = await this.api.getBalance(wallet);
                
                console.log(`${i + 1}. ${account.address}`);
                console.log(`   Balance: ${balance} ETH`);
                console.log(`   Proxy: ${account.proxy || 'Tidak ada'}`);
                console.log('');
            } catch (error) {
                console.log(`${i + 1}. ${account.address} - Error: ${error.message}`);
            }
        }
    }
}

// Jalankan bot
async function main() {
    try {
        const bot = new PharosBot();
        await bot.initialize();
        await bot.showMenu();
    } catch (error) {
        console.error(chalk.red('❌ Bot gagal dijalankan:'), error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Bot dihentikan oleh user'));
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', null, error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', null, reason);
});

// Jalankan main function
if (require.main === module) {
    main();
}

module.exports = PharosBot;
