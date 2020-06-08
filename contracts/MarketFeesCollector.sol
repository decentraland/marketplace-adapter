// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "./dex/IConverter.sol";
import "./ConverterManager.sol";

import "@openzeppelin/contracts/access/Ownable.sol";


contract MarketFeesCollector is Ownable, ConverterManager {

    event FeesReceived(address from, uint256 amount);
    event ReserveTokenChanged(address indexed token);

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
        setReserveToken(_reserveToken);
    }

    function setReserveToken(address _reserveToken) public onlyOwner {
        reserveToken = IERC20(_reserveToken);
        emit ReserveTokenChanged(_reserveToken);
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

        // Burn tokens by transfer to address(0)
        reserveToken.transfer(
            address(0),
            totalConverted
        );

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
