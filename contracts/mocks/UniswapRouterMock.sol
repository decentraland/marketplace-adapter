// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;


// Mock called IUniswapV2Router01 methods
contract UniswapRouterMock {

    function WETH() public pure returns (address) {
        return address(0);
    }

    function swapExactETHForTokens(uint, address[] memory, address, uint)
        public payable returns (uint[] memory amounts)
    {
        amounts = new uint[](2);

        amounts[0] = msg.value;
        amounts[1] = 10 ether;
    }
}
