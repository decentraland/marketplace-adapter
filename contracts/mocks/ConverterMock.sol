// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "../dex/IConverter.sol";


contract ConverterMock is IConverter {
    function getTrader() public view override returns (address) {
        return address(0);
    }

    function calcEtherToToken(IERC20, uint256) public view override returns (uint256) {
        return 0;
    }

    function swapEtherToToken(IERC20) public payable override returns (uint256) {
        return 0;
    }

    function swapTokenToEther(IERC20, uint256) public override returns (uint256) {
        return 0;
    }
}
