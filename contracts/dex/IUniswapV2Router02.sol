// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;


interface IUniswapV2Router02 {

    function WETH() external pure returns (address);

    function getAmountsIn(
        uint amountOut,
        address[] calldata path
    )
        external view returns (uint[] memory amounts);


    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external returns (uint[] memory amounts);


    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external payable returns (uint[] memory amounts);
}
