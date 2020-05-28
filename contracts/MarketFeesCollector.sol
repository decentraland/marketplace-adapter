// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MarketFeesCollector is Ownable {

    event CollectedFeesBurned(
        address indexed callingAddr,
        uint256 etherBalance,
        uint256 burnedTokens
    );

    address public immutable exchangeToken;
    address public immutable uniswapV2Router;

    /**
     * @param _token ERC20 token address used on the final exchange pair
     * @param _router Uniswap V2 router address. https://uniswap.org/docs/v2/smart-contracts/router/
     */
    constructor(
        address _token,
        address _router
    )
        Ownable() public
    {
        exchangeToken = _token;
        uniswapV2Router = _router;
    }

    /**
     * burnCollectedFees:
     */
    function burnCollectedFees() public {

        /// Burn accumulated ether balance
        IUniswapV2Router01 router = IUniswapV2Router01(uniswapV2Router);

        address[] memory path = new address[](2);

        path[0] = router.WETH();
        path[1] = exchangeToken;

        uint256 etherBalance = address(this).balance;

        /// https://uniswap.org/docs/v2/smart-contracts/router/#swapexactethfortokens
        uint256[] memory amounts = router.swapExactETHForTokens{
            value: etherBalance
        }(
            0,
            path,
            address(0),
            block.timestamp
        );

        require(address(this).balance == 0, 'MarketFeeBurner: FAILED ETH-TOKEN SWAP');

        emit CollectedFeesBurned(
            msg.sender,
            etherBalance,
            amounts[amounts.length - 1]
        );
    }
}
