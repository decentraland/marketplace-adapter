// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "./IConverter.sol";
import "./IKyberNetworkProxy.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract KyberConverter is IConverter {

    using SafeMath for uint256;

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
        (uint256 rate, ) = kyberProxy.getExpectedRate(
            IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee),
            IERC20(_dstToken),
            _etherAmount
        );

        // return the token amount in _dstToken units
        return _etherAmount.mul(rate).div(1e18);
    }

    function swapTokenToEther(
        IERC20 _srcToken,
        uint256 _srcAmount
    )
        public override returns (uint256)
    {
        return kyberProxy.swapTokenToEther(
            IERC20(_srcToken), _srcAmount, 0
        );
    }

    function swapEtherToToken(
        IERC20 _dstToken
    )
        payable public override returns (uint256)
    {
        return kyberProxy.swapEtherToToken{ value: msg.value }(_dstToken, 0);
    }

    receive() external payable {
        //
    }
}
