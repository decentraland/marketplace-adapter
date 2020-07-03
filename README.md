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

## Deploy MarketAdapter
oz deploy MarketAdapter

```
? Pick a network infura_ropsten
? _converter: address: 0x5d06D8FE0b791e896801ABc0cc7297F232aD7777
? _collector: address: 0x5DC888024cB599CfDdb9E6483ED6bAe1fA9e9D18
? _adapderFee: uint256: 10000
```

## Deployed Ropsten addresses

### Converters
```
KyberConverter: 0x621Ec2B2467E39d578a4D172182AF55E610cf4B9
UniswapConverter: 0x5d06D8FE0b791e896801ABc0cc7297F232aD7777
```

### MarketFeesCollector
```
- Using Kyber: 0xd68db540463ed271302ab19072e26589c9e9d4a1 (MANA: 0x72fd6C7C1397040A66F33C2ecC83A0F71Ee46D5c)
- Using Uniswap: 0x5DC888024cB599CfDdb9E6483ED6bAe1fA9e9D18 (MANA: 0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb)
```

### MarketAdapter:
```
- Using Kyber: 0x237a18B36D862444AFD20D2b00b57d79c4A1F474
- Using Uniswap: 0xb242973f4347975A060E71c3F3eACAe535874Be9
```
