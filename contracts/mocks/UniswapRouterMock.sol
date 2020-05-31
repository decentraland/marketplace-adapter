// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "../dex/IUniswapV2Router01.sol";


// Mock called IUniswapV2Router01 methods
contract UniswapRouterMock is IUniswapV2Router01 {

    function WETH() public pure override returns (address) {
        return address(0);
    }

    function swapExactETHForTokens(uint, address[] memory, address, uint)
        public payable override returns (uint[] memory amounts)
    {
        amounts = new uint[](2);

        amounts[0] = msg.value;
        amounts[1] = msg.value;
    }
}
