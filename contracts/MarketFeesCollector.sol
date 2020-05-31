// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./dex/IConverter.sol";

contract MarketFeesCollector is Ownable {

    event FeesReceived(address from, uint amount);

    event CollectedFeesBurned(
        address indexed callingAddr,
        uint256 etherBalance,
        uint256 burnedTokens
    );

    event SetConverter(address indexed converter);

    // configured fee
    IConverter public feesConverter;

    /**
     * @param _converter address of collected fees burner implementation
     */
    constructor(address _converter) Ownable() public {
        setConverter(_converter);
    }

    /**
     * @param _converter address of collected fees burner implementation
     */
    function setConverter(address _converter) public onlyOwner {
        feesConverter = IConverter(_converter);
        emit SetConverter(_converter);
    }

    /**
     * burnCollectedFees:
     */
    function burnCollectedFees() public {
        require(
            address(feesConverter) != address(0),
            "MarketFeesCollector: converter unavailable"
        );

        uint256 totalBalance = address(this).balance;
        uint256 totalConverted = feesConverter.burn{
            value: totalBalance
        }();

        emit CollectedFeesBurned(
            msg.sender,
            totalBalance,
            totalConverted
        );
    }

    receive() external payable {
        emit FeesReceived(msg.sender, msg.value);
    }
}
