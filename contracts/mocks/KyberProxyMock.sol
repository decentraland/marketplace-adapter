// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "../dex/IKyberNetworkProxy.sol";


// Mock KyberProxy
contract KyberProxyMock is IKyberNetworkProxy {

    function trade(
        IERC20,
        uint,
        IERC20,
        address,
        uint,
        uint,
        address
    )
        public payable override returns (uint256)
    {
        return msg.value;
    }
}
