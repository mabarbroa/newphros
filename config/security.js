const crypto = require('crypto');
const fs = require('fs-extra');
require('dotenv').config();

class SecurityManager {
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY;
        if (!this.encryptionKey || this.encryptionKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY harus 32 karakter di file .env');
        }
    }

    // Enkripsi private key
    encryptPrivateKey(privateKey) {
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    // Dekripsi private key
    decryptPrivateKey(encryptedKey) {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            throw new Error('Gagal mendekripsi private key');
        }
    }

    // Validasi private key format
    validatePrivateKey(privateKey) {
        const cleanKey = privateKey.replace('0x', '');
        if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
            throw new Error('Format private key tidak valid');
        }
        return '0x' + cleanKey;
    }

    // Baca dan dekripsi accounts
    async loadAccounts() {
        try {
            const accountsPath = './data/accounts.encrypted';
            if (!await fs.pathExists(accountsPath)) {
                console.log('File accounts.encrypted tidak ditemukan. Membuat file baru...');
                return [];
            }

            const encryptedData = await fs.readFile(accountsPath, 'utf8');
            const accounts = JSON.parse(encryptedData).map(acc => ({
                ...acc,
                privateKey: this.decryptPrivateKey(acc.encryptedKey)
            }));

            return accounts;
        } catch (error) {
            throw new Error(`Gagal memuat accounts: ${error.message}`);
        }
    }

    // Simpan accounts dengan enkripsi
    async saveAccounts(accounts) {
        try {
            const encryptedAccounts = accounts.map(acc => ({
                address: acc.address,
                encryptedKey: this.encryptPrivateKey(acc.privateKey),
                proxy: acc.proxy || null
            }));

            await fs.ensureDir('./data');
            await fs.writeFile('./data/accounts.encrypted', JSON.stringify(encryptedAccounts, null, 2));
            console.log('✅ Accounts berhasil disimpan dengan enkripsi');
        } catch (error) {
            throw new Error(`Gagal menyimpan accounts: ${error.message}`);
        }
    }
}

module.exports = SecurityManager;
