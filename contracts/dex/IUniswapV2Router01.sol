// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;


interface IUniswapV2Router01 {
    function WETH() external pure returns (address);
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external payable returns (uint[] memory amounts);
}
