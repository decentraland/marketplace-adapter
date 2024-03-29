# Decentraland marketplace-adapter

Adapter and fee collector contracts for 3rd parties NFTs marketplaces

## Compile

npx oz compile --solc-version=0.6.8 --optimizer on

## Tests

npm run test

## Deployment

### Deploy converters

oz deploy KyberConverter
oz deploy UniswapV2Converter

```
? Pick a network infura_ropsten
? _uniswapV2Router: address: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
```

### Deploy MarketFeesCollector

oz deploy MarketFeesCollector

```
? Pick a network infura_ropsten
? _converter: 0x5d06D8FE0b791e896801ABc0cc7297F232aD7777
? _reserveToken: 0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb
```

## Deploy BuyAdapter

oz deploy BuyAdapter

```
? Pick a network infura_ropsten
? _converter: address: 0x5d06D8FE0b791e896801ABc0cc7297F232aD7777
? _collector: address: 0x5DC888024cB599CfDdb9E6483ED6bAe1fA9e9D18
? _adapderFee: uint256: 10000
```

## Deployed Ropsten addresses

### Converters

```
KyberConverter: 0x234f6ba3de0494d043e23b5bfb3663366d86272d
UniswapConverter: 0x2782eb28Dcb1eF4E7632273cd4e347e130Ce4646
```

### MarketFeesCollector

```
- Using Kyber: 0xd68db540463ed271302ab19072e26589c9e9d4a1
- Using Uniswap: 0x5DC888024cB599CfDdb9E6483ED6bAe1fA9e9D18
```

### BuyAdapter:

```
- Using Kyber: 0x61fE4a720E177FA01bCa31DDD9CDbD5D5cf7C2ee
- Using Uniswap: 0x8512Fc051B3f8A3A5043F93278DEFe1389E2668C
```
