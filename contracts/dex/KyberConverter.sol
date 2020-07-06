// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "./IConverter.sol";
import "./IKyberNetworkProxy.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract KyberConverter is IConverter {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IKyberNetworkProxy private immutable kyberProxy;

    uint256 constant MAX_UINT_VALUE = 2**256 - 1;
    uint256 constant GROSSING_UP_PERCENTAGE = 105;

    /**
     * @param _kyberProxy KyberProxy address.
     */
    constructor(address _kyberProxy) public {
        kyberProxy = IKyberNetworkProxy(_kyberProxy);
    }

    function getTrader() public view override returns (address) {
        return address(kyberProxy);
    }

    function calcNeededTokensForEther(
        IERC20 _dstToken,
        uint256 _etherAmount
    )
        public view override returns (uint256)
    {
        // check expected rate for this token -> eth pair
        (uint256 exchangeRate, ) = kyberProxy.getExpectedRate(
            IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee),
            IERC20(_dstToken),
            _etherAmount
        );

        // https://github.com/KyberNetwork/smart-contracts/blob/master/contracts/Utils.sol#L34-L45
        // simplified calcDestQty from with source / destination tokens both having 1e18 precision

        return _etherAmount.mul(exchangeRate)
            .div(1e18)
            .mul(GROSSING_UP_PERCENTAGE)
            .div(100);
    }

    function swapTokenToEther(
        IERC20 _srcToken,
        uint256 _srcAmount,
        uint256 _maxDstAmount
    )
        public override returns (uint256 dstAmount, uint256 srcRemainder)
    {
        require(_srcAmount > 0, "KyberConverter: _srcAmount error");

        // save pre balance
        uint256 prevSrcBalance = _srcToken.balanceOf(address(this));

        // Get Tokens from caller and aprove exchange
        _srcToken.safeTransferFrom(msg.sender, address(this), _srcAmount);
        _srcToken.safeApprove(address(kyberProxy), _srcAmount);

        dstAmount = kyberProxy.trade(
            _srcToken,  // srcToken
            _srcAmount, // srcAmount
            IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee), // dstToken
            msg.sender, // dstAddress
            _maxDstAmount, // maxDstAmount
            0, // minConversion Rate
            address(0) // walletId for fees sharing
        );

        // clear approval
        _srcToken.safeApprove(address(kyberProxy), 0);

        // Check if the amount traded is equal to the expected one
        require(dstAmount == _maxDstAmount, "KyberConverter: Token <> Ether error");

        srcRemainder = _srcToken.balanceOf(address(this)).sub(prevSrcBalance);

        // If theres a remainder, transfer remainder tokens back to caller
        if (srcRemainder > 0) {
            _srcToken.safeTransfer(msg.sender, srcRemainder);
        }
    }

    function swapEtherToToken(
        IERC20 _dstToken
    )
        payable public override returns (uint256)
    {
        require(msg.value > 0, "KyberConverter: msg.value error");

        uint256 dstTokenAmount = kyberProxy.trade{
            value: msg.value
        }(
            IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee), // srcToken
            msg.value, // srcAmount
            _dstToken, // dstToken
            msg.sender, // dstAddress
            MAX_UINT_VALUE, // maxDestAmount
            0, // minConversion Rate
            address(0) // walletId for fees sharing
        );

        require(dstTokenAmount > 0, "KyberConverter: Ether <> Token error");

        return dstTokenAmount;
    }
}
