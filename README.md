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
? _converter: address: 0xebaD4dDa9b1D7A7FFa1c0587AF07275Eb53c5633
? _reserveToken: address: 0x72fd6C7C1397040A66F33C2ecC83A0F71Ee46D5c
```

## Deploy MarketAdapter
oz deploy MarketAdapter

```
? Pick a network infura_ropsten
? _converter: address: 0xebaD4dDa9b1D7A7FFa1c0587AF07275Eb53c5633
? _collector: address: 0x0C049f43a96bD0F91b9a48B7cCE48fEBbF93F98F
? _adapderFee: uint256: 25000
```

## Deployed Ropsten addresses

### MarketFeesCollector
 - Using Real MANA: "0x4a1b52d3dcad59212d11ab7a5ec81b9f3c973006"
 - Using Kyber MANA: "0xd28fcd59322aa58ea8be8f2e62d5a994bba57af8"

### MarketAdapter:
- Using Real MANA: "0x4a1b52d3dcad59212d11ab7a5ec81b9f3c973006"
- Using Kyber MANA: "0xd28fcd59322aa58ea8be8f2e62d5a994bba57af8"
