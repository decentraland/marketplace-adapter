// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "../dex/IKyberNetworkProxy.sol";


// Mock KyberProxy
contract KyberProxyMock is IKyberNetworkProxy {

    function getExpectedRate(
        IERC20,
        IERC20,
        uint256
    )
        public view override returns (uint256 expectedRate, uint256 slippageRate)
    {
        expectedRate = 1;
        slippageRate = 0;
    }

    function swapEtherToToken(
       IERC20,
       uint256
    )
        external payable override returns (uint256)
    {
        return msg.value;
    }

    function swapTokenToEther(
        IERC20,
        uint256 srcAmount,
        uint256
    )
        external override returns (uint256)
    {
        return srcAmount;
    }
}
