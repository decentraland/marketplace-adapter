#! /bin/bash

FEES_COLLECTOR=MarketFeesCollector.sol
KYBER_CONVERTER=dex/KyberConverter.sol
UNISWAP_CONVERTER=dex/UniswapV2Converter.sol
BUY_ADAPTER=BuyAdapter.sol

OUTPUT=full

npx truffle-flattener contracts/$FEES_COLLECTOR  > $OUTPUT/$FEES_COLLECTOR && sed 's/SPDX//2g' $OUTPUT/$FEES_COLLECTOR
npx truffle-flattener contracts/$KYBER_CONVERTER > $OUTPUT/$KYBER_CONVERTER
npx truffle-flattener contracts/$UNISWAP_CONVERTER > $OUTPUT/$UNISWAP_CONVERTER
npx truffle-flattener contracts/$BUY_ADAPTER > $OUTPUT/$BUY_ADAPTER
