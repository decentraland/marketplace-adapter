// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IConverter {
    function getTrader() external view returns (address);
    function calcNeededTokensForEther(IERC20 _dstToken, uint256 _etherAmount) external view returns (uint256);
    function swapEtherToToken(IERC20 _dstToken) external payable returns (uint256);
    function swapTokenToEther(IERC20 _srcToken, uint256 _srcAmount, uint256 _maxDstAmount)
        external returns (uint256 dstAmount, uint256 srcRemainder);
}

