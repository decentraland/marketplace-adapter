// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IKyberNetworkProxy {
    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint256 srcQty
    )
        external view returns (uint256 expectedRate, uint256 slippageRate);

    function trade(
        IERC20 src,
        uint256 srcAmount,
        IERC20 dest,
        address destAddress,
        uint256 maxDestAmount,
        uint256 minConversionRate,
        address walletId
    )
        external payable returns (uint256);
}
