// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "../dex/IUniswapV2Router02.sol";


// Mock called IUniswapV2Router01 methods
contract UniswapRouterMock is IUniswapV2Router02 {

    function WETH() external pure override returns (address) {
        return address(0);
    }

    function getAmountsOut(
        uint amountIn,
        address[] calldata
    )
        external view override returns (uint[] memory amounts)
    {
        amounts = new uint[](2);

        amounts[0] = amountIn;
        amounts[1] = amountIn;
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint,
        address[] calldata,
        address,
        uint
    )
        external override returns (uint[] memory amounts)
    {
        amounts = new uint[](2);

        amounts[0] = amountIn;
        amounts[1] = amountIn;
    }

    function swapExactETHForTokens(
        uint,
        address[] calldata,
        address,
        uint
    )
        external payable override returns (uint[] memory amounts)
    {
        amounts = new uint[](2);

        amounts[0] = msg.value;
        amounts[1] = msg.value;
    }
}
