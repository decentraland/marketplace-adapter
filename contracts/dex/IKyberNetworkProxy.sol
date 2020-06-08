// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IKyberNetworkProxy {
    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint256 srcQty
    )
        external view returns (uint256 expectedRate, uint256 slippageRate);

    function swapEtherToToken(
       IERC20 token,
       uint256 minConversionRate
    )
        external payable returns (uint256);

    function swapTokenToEther(
        IERC20 token,
        uint256 srcAmount,
        uint256 minConversionRate
    )
        external returns (uint256);
}
