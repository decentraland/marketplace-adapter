// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../dex/IConverter.sol";


contract ConverterMock is IConverter {
    function getTrader() public view override returns (address) {
        return address(0);
    }

    function calcNeededTokensForEther(IERC20, uint256) public view override returns (uint256) {
        return 0;
    }

    function swapEtherToToken(IERC20) public payable override returns (uint256) {
        return 0;
    }

    function swapTokenToEther(IERC20, uint256, uint256) public override returns (uint256, uint256) {
        return (0, 0);
    }
}
