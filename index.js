const fs = require('fs');
const Web3 = require('web3');
const chalk = require('chalk');
const prompt = require('prompt-sync')();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Banner
function showBanner() {
  console.clear();
  console.log(chalk.magentaBright(`
========================================
  █████╗ ██╗   ██╗████████╗ ██████╗ 
 ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗
 ███████║██║   ██║   ██║   ██║   ██║
 ██╔══██║██║   ██║   ██║   ██║   ██║
 ██║  ██║╚██████╔╝   ██║   ╚██████╔╝
 ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ 
SAT SET 
                           [by Chandra]
========================================
`));
}

// Fungsi ambil IP publik melalui proxy
async function getPublicIP(proxy) {
  try {
    const agent = new HttpsProxyAgent(proxy);
    const res = await axios.get('https://api.ipify.org?format=text', { httpsAgent: agent, timeout: 10000 });
    return res.data;
  } catch (err) {
    return `Gagal ambil IP (${err.message})`;
  }
}

// Konstanta
const RPC = "https://dream-rpc.somnia.network";
const contractAddress = '0x496eF0E9944ff8c83fa74FeB580f2FB581ecFfFd';
const abi = [{
  "inputs": [
    { "internalType": "uint256", "name": "x", "type": "uint256" },
    { "internalType": "uint256", "name": "y", "type": "uint256" },
    { "internalType": "uint24", "name": "color", "type": "uint24" }
  ],
  "name": "colorPixel",
  "outputs": [],
  "stateMutability": "payable",
  "type": "function"
}];

// Load akun dan proxy
const privateKeys = fs.readFileSync('akun.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);

const proxies = fs.existsSync('proxy.txt') ? fs.readFileSync('proxy.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0) : [];

showBanner();

const pixelCount = prompt(chalk.yellow('⚛️ Berapa jumlah pixel yang ingin kamu warnai untuk setiap akun? '));
if (isNaN(pixelCount) || pixelCount <= 0) {
  console.log(chalk.red('❌ Jumlah pixel harus berupa angka positif.'));
  process.exit(1);
}
console.log(chalk.green(`Jumlah pixel yang akan diwarnai untuk setiap akun: ${pixelCount}`));

(async () => {
  for (let index = 0; index < privateKeys.length; index++) {
    const privateKey = privateKeys[index];
    const proxy = proxies[index] || null;

    let web3;
    if (proxy) {
      const agent = new HttpsProxyAgent(proxy);
      const provider = new Web3.providers.HttpProvider(RPC, { agent });
      web3 = new Web3(provider);
    } else {
      web3 = new Web3(RPC);
    }

    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);
    const contract = new web3.eth.Contract(abi, contractAddress);

    console.log(chalk.cyan(`\n👩‍💻 [${index + 1}/${privateKeys.length}] Akun: ${account.address}`));

    if (proxy) {
      console.log(chalk.gray(`🛡️ Proxy digunakan: ${proxy}`));
      const ip = await getPublicIP(proxy);
      console.log(chalk.gray(`🌐 IP Publik Proxy: ${ip}`));
    } else {
      console.log(chalk.red('⚠️ Tidak ada proxy digunakan untuk akun ini.'));
    }

    for (let i = 0; i < pixelCount; i++) {
      try {
        const x = Math.floor(Math.random() * 1024);
        const y = Math.floor(Math.random() * 1024);
        const color = Math.floor(Math.random() * 0xFFFFFF);

        const nonce = await web3.eth.getTransactionCount(account.address, 'latest');
        const latestBlock = await web3.eth.getBlock('latest');
        const baseFee = latestBlock.baseFeePerGas || web3.utils.toWei('1', 'gwei');

        let priorityFee = web3.utils.toWei('2', 'gwei');
        if (baseFee > web3.utils.toWei('20', 'gwei')) priorityFee = web3.utils.toWei('3', 'gwei');
        if (baseFee > web3.utils.toWei('50', 'gwei')) priorityFee = web3.utils.toWei('5', 'gwei');
        if (baseFee > web3.utils.toWei('100', 'gwei')) priorityFee = web3.utils.toWei('8', 'gwei');

        const maxFee = BigInt(baseFee) + BigInt(priorityFee) + (BigInt(baseFee) / 5n);

        const tx = {
          from: account.address,
          to: contractAddress,
          value: web3.utils.toWei('0.01', 'ether'),
          gas: 300000,
          maxFeePerGas: maxFee.toString(),
          maxPriorityFeePerGas: priorityFee,
          nonce,
          chainId: await web3.eth.getChainId(),
          data: contract.methods.colorPixel(x, y, color).encodeABI()
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(chalk.green(`✅ [${i + 1}/${pixelCount}] Transaksi sukses!`));
        console.log(chalk.magentaBright(`  Hash: ${receipt.transactionHash}`));
        console.log(chalk.blue(`  Pixel: x=${x}, y=${y}`));
        console.log(chalk.yellow(`  Warna: #${color.toString(16).padStart(6, '0').toUpperCase()}`));
        console.log(chalk.cyan(`  baseFee: ${web3.utils.fromWei(baseFee.toString(), 'gwei')} gwei`));
        console.log(chalk.green(`  maxPriorityFee: ${web3.utils.fromWei(priorityFee, 'gwei')} gwei`));
        console.log(chalk.red(`  maxFee: ${web3.utils.fromWei(maxFee.toString(), 'gwei')} gwei`));
      } catch (err) {
        console.log(chalk.red(`❌ Transaksi gagal: ${err.message}`));
      }

      if (i < pixelCount - 1) {
        console.log(chalk.gray(`⏳ Menunggu 30 detik sebelum transaksi selanjutnya...\n`));
        await new Promise(res => setTimeout(res, 30000));
      }
    }

    console.log(chalk.greenBright(`✅ Semua pixel untuk akun ${account.address} selesai!\n`));
    await new Promise(res => setTimeout(res, 500));
  }

  console.log(chalk.bgMagenta.whiteBright('Selesai semua akun! 🎉'));
})();
