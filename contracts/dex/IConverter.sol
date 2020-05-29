// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;


interface IConverter {
    /**
     * @dev convert value to Ether -> ERC20
     */
    function burn() external payable returns (uint256);
}
