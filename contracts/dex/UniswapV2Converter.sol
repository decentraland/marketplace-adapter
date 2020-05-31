// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "./IConverter.sol";
import "./IUniswapV2Router01.sol";


contract UniswapV2Converter is IConverter {

    IUniswapV2Router01 private immutable uniswapV2Router;

    address private immutable srcToken;
    address private immutable dstToken;

    /**
     * @param _dstToken ERC20 token address used on the final exchange pair
     * @param _uniswapV2Router UniswapV2Router01 address.
     */
    constructor(
        address _dstToken,
        address _uniswapV2Router
    )
        public
    {
        IUniswapV2Router01 router = IUniswapV2Router01(_uniswapV2Router);

        srcToken = router.WETH();
        dstToken = _dstToken;

        uniswapV2Router = router;
    }

    /**
     * @dev Trade total ether balance for dstToken and burns
     *  the resulting tokens by sending them to address(0)
     */
    function burn() public payable override returns (uint256) {

        address[] memory path = new address[](2);

        path[0] = srcToken;
        path[1] = dstToken;

        uint256 srcAmount = address(this).balance;

        // https://uniswap.org/docs/v2/smart-contracts/router/#swapexactethfortokens
        uint256[] memory amounts = uniswapV2Router.swapExactETHForTokens{
            value: srcAmount
        }(
            0,
            path,
            address(0),
            block.timestamp
        );

        require(address(this).balance == 0, "UniswapV2Converter: unable to convert total balance");

        // returns total converted tokens
        return amounts[1];
    }
}
