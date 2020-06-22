require('@babel/register')
require('@babel/polyfill')

require('dotenv').config();

const HDWalletProvider = require('@truffle/hdwallet-provider')

const createWalletProvider = (mnemonic, rpcEndpoint) =>
  new HDWalletProvider(mnemonic, rpcEndpoint)

const createInfuraProvider = (network = 'mainnet') =>
  createWalletProvider(
    process.env.MNEMONIC || '',
    `https://${network}.infura.io/v3/${process.env.INFURA_API_KEY}`
  )

module.exports = {
  plugins: ["solidity-coverage"],
  compilers: {
    solc: {
      version: "0.6.8"
    }
  },
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      gas: 5500000,
      gasPrice: 5e9,
      network_id: '*'
    },
    infura_ropsten: {
      provider: () => createInfuraProvider('ropsten'),
      gas: 5500000,
      gasPrice: 5e9,
      network_id: 3
    },
    infura_mainnet: {
      provider: () => createInfuraProvider('mainnet'),
      gas: 5500000,
      gasPrice: 5e9,
      network_id: 1
    }
  }
}
