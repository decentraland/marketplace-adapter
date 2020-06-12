// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "./dex/IConverter.sol";
import "./ConverterManager.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";


contract MarketFeesCollector is Ownable, ConverterManager {

    using SafeERC20 for IERC20;

    event FeesReceived(address from, uint256 amount);

    event CollectedFeesBurned(
        address indexed callingAddr,
        address indexed burnedToken,
        uint256 etherBalance,
        uint256 burnedTokens
    );

    IERC20 public reserveToken;

    /**
     * @param _converter address of collected fees burner implementation
     * @param _reserveToken address of ERC20 to exchange for the retained fees
     */
    constructor(
        address _converter,
        address _reserveToken
    )
        Ownable() public
    {
        setConverter(_converter);
        reserveToken = IERC20(_reserveToken);
    }

    /**
     * @dev Swaps contract balance to configured reserve in ERC20 token
     *  and sends converted amount to address(0)
     */
    function burnCollectedFees() external {

        require(
            converterAddress != address(0),
            "MarketFeesCollector: converter unavailable"
        );

        uint256 totalBalance = address(this).balance;
        uint256 totalConverted = IConverter(converterAddress).swapEtherToToken{
            value: totalBalance
        }(
            reserveToken
        );

        require(totalConverted > 0, "MarketFeesCollector: conversion error");

        /*
         * Calls a burn(uint) interface if implemented.
         *  fallbacks to a safeTransfer()
         */

        bytes memory encodedParams = abi.encodeWithSelector(
            ERC20Burnable.burn.selector,
            totalConverted
        );

        (bool success,) = address(reserveToken).call(encodedParams);

        if (!success) {
            reserveToken.safeTransfer(address(0), totalConverted);
        }

        emit CollectedFeesBurned(
            msg.sender,
            address(reserveToken),
            totalBalance,
            totalConverted
        );
    }

    receive() external payable {
        emit FeesReceived(msg.sender, msg.value);
    }
}
