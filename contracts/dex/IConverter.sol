// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IConverter {
    function getTrader() external view returns (address);
    function calcEtherToToken(IERC20 _dstToken, uint256 _etherAmount) external view returns (uint256);
    function swapEtherToToken(IERC20 _dstToken) external payable returns (uint256);
    function swapTokenToEther(IERC20 _srcToken, uint256 _srcAmount) external returns (uint256);
}
