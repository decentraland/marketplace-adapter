// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IConverter.sol";

interface KyberNetworkProxy {
    function trade(
        IERC20 _srcToken,
        uint _srcAmount,
        IERC20 _destToken,
        address _destAddress,
        uint _maxDestAmount,
        uint _minConversionRate,
        address _walletId
        )
        external payable returns(uint);
}

contract KyberConverter is IConverter {

    address private immutable kyberProxy;

    IERC20 private immutable srcToken;
    IERC20 private immutable dstToken;

    /**
     * @param _dstToken ERC20 token address used on the final exchange pair
     * @param _kyberProxy KyberProxy address.
     */
    constructor(
        address _dstToken,
        address _kyberProxy
    )
        public
    {
        srcToken = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // ETH
        dstToken = IERC20(_dstToken);

        kyberProxy = _kyberProxy;
    }

    /**
     * @dev Trade total ether balance for dstToken and burns
     *  the resulting tokens by sending them to address(0)
     */
    function burn() public payable override returns (uint256) {

        uint256 srcAmount = address(this).balance;

        // Trade srcAmount from srcToken to dstToken
        uint256 amount = KyberNetworkProxy(kyberProxy).trade{
            value: srcAmount
        }(
            srcToken,
            srcAmount,
            dstToken,
            address(0),
            0,
            0,
            address(0)
        );

        require(address(this).balance == 0, "KyberConverter: unable to convert total balance");

        return amount;
    }
}
