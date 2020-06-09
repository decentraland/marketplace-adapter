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

    /**
     * @param _kyberProxy KyberProxy address.
     */
    constructor(address _kyberProxy) public {
        kyberProxy = IKyberNetworkProxy(_kyberProxy);
    }

    function calcEtherToToken(
        IERC20 _dstToken,
        uint256 _etherAmount
    )
        public view override returns (uint256)
    {
        // check expected rate for this token -> eth pair
        (uint256 expectedRate, ) = kyberProxy.getExpectedRate(
            IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee),
            IERC20(_dstToken),
            _etherAmount
        );

        // return the token amount in _dstToken units
        return _etherAmount.mul(expectedRate).div(1e18);
    }

    function swapTokenToEther(
        IERC20 _srcToken,
        uint256 _srcAmount
    )
        public override returns (uint256)
    {
        require(_srcAmount > 0, "KyberConverter: _srcAmount error");

        // Get Tokens from caller and aprove exchange
        _srcToken.safeTransferFrom(msg.sender, address(this), _srcAmount);
        _srcToken.safeApprove(address(kyberProxy), _srcAmount);

        uint256 dstTokenAmount = kyberProxy.trade(
            _srcToken,  // srcToken
            _srcAmount, // srcAmount
            IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee), // dstToken
            msg.sender, // dstAddress
            0, // maxDestAmount
            0, // minConversion Rate
            address(0) // walletId for fees sharing
        );

        require(dstTokenAmount > 0, "KyberConverter: Token <> Ether error");

        return dstTokenAmount;
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
            0, // maxDestAmount
            0, // minConversion Rate
            address(0) // walletId for fees sharing
        );

        require(dstTokenAmount > 0, "KyberConverter: Ether <> Token error");

        return dstTokenAmount;
    }
}
