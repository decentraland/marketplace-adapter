// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "./IConverter.sol";
import "./IUniswapV2Router02.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract UniswapV2Converter is IConverter {

    using SafeERC20 for IERC20;

    IUniswapV2Router02 private immutable uniswapV2Router;

    /**
     * @param _uniswapV2Router UniswapV2Router02 address.
     */
    constructor(address _uniswapV2Router) public {
        uniswapV2Router = IUniswapV2Router02(_uniswapV2Router);
    }

    function getTrader() public view override returns (address) {
        return address(uniswapV2Router);
    }

    function calcNeededTokensForEther(
        IERC20 _dstToken,
        uint256 _etherAmount
    )
        public view override returns (uint256)
    {
        address[] memory path = new address[](2);

        path[0] = address(_dstToken);
        path[1] = uniswapV2Router.WETH();

        uint256[] memory amounts = uniswapV2Router.getAmountsIn(
            _etherAmount,
            path
        );

        return amounts[0];
    }

    function swapTokenToEther(
        IERC20 _srcToken,
        uint256 _srcAmount
    )
        public override returns (uint256)
    {
        // Get Tokens from caller and aprove exchange
        _srcToken.safeTransferFrom(msg.sender, address(this), _srcAmount);
        _srcToken.safeApprove(address(uniswapV2Router), _srcAmount);

        address[] memory path = new address[](2);

        path[0] = address(_srcToken);
        path[1] = uniswapV2Router.WETH();

        uint256[] memory amounts = uniswapV2Router.swapExactTokensForETH(
            _srcAmount,
            0,
            path,
            msg.sender,
            block.timestamp
        );

        // return output token amount
        return amounts[1];
    }

    function swapEtherToToken(
        IERC20 _dstToken
    )
        payable public override returns (uint256)
    {
        address[] memory path = new address[](2);

        path[0] = uniswapV2Router.WETH();
        path[1] = address(_dstToken);

        uint256[] memory amounts = uniswapV2Router.swapExactETHForTokens{
            value: msg.value
        }(
            0,
            path,
            msg.sender,
            block.timestamp
        );

        // return output token amount
        return amounts[1];
    }
}
