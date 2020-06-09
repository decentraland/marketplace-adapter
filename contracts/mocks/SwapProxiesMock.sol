// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "../dex/IKyberNetworkProxy.sol";
import "../dex/IUniswapV2Router02.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract SwapProxyMock {

    using SafeERC20 for IERC20;

    function _swapEtherToToken(
        IERC20 _dstToken,
        uint256 _etherAmount,
        address _dstAddress
    )
        internal returns (uint256)
    {
        require(_etherAmount > 0, "SwapProxyMock: balance > 0 error");

        uint256 tokenBalance = _dstToken.balanceOf(address(this));

        require(
            tokenBalance >= _etherAmount,
            "SwapProxyMock: balance token/eth error"
        );

        _dstToken.safeTransfer(_dstAddress, _etherAmount);

        return _etherAmount;
    }

    function _swapTokenToEther(
        IERC20 _srcToken,
        uint256 _srcAmount,
        address payable _dstAddress
    )
        internal returns (uint256)
    {
        // Get tokens, send ethers to caller
        _srcToken.safeTransferFrom(msg.sender, address(this), _srcAmount);
        _dstAddress.transfer(_srcAmount);

        return _srcAmount;
    }

    receive() external payable {
        //
    }
}

// Mock KyberProxy
contract KyberProxyMock is SwapProxyMock, IKyberNetworkProxy {

    function getExpectedRate(
        IERC20,
        IERC20,
        uint256
    )
        public view override returns (uint256 expectedRate, uint256 slippageRate)
    {
        // 1 <> 1 conversion
        expectedRate = 1e18;
        slippageRate = 0;
    }

    function trade(
        IERC20 _srcToken,
        uint256 _srcAmount,
        IERC20 _dstToken,
        address _dstAddress,
        uint256, // _maxDestAmount,
        uint256, // _minConversionRate,
        address  // _walletId
    )
        public payable override returns (uint256)
    {
        if (_srcToken == IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee)) {
            return _swapEtherToToken(_dstToken, msg.value, _dstAddress);
        }
        return _swapTokenToEther(_srcToken, _srcAmount, payable(_dstAddress));
    }
}

// Mock called IUniswapV2Router02 methods
contract UniswapRouterMock is SwapProxyMock, IUniswapV2Router02 {

    function WETH() external pure override returns (address) {
        return address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    }

    function getAmountsOut(
        uint _amountIn,
        address[] calldata
    )
        external view override returns (uint[] memory amounts)
    {
        amounts = new uint[](2);

        amounts[0] = _amountIn;
        amounts[1] = _amountIn;
    }

    function swapExactTokensForETH(
        uint _amountIn,
        uint,
        address[] calldata _path,
        address _to,
        uint
    )
        external override returns (uint[] memory amounts)
    {
        uint256 convertedTokens = _swapTokenToEther(
            IERC20(_path[0]),
            _amountIn,
            payable(_to)
        );

        amounts = new uint[](2);

        amounts[0] = _amountIn;
        amounts[1] = convertedTokens;
    }

    function swapExactETHForTokens(
        uint,
        address[] calldata _path,
        address _to,
        uint
    )
        external payable override returns (uint[] memory amounts)
    {
        uint256 convertedTokens = _swapEtherToToken(
            IERC20(_path[_path.length - 1]),
            msg.value,
            _to
        );

        amounts = new uint[](2);

        amounts[0] = msg.value;
        amounts[1] = convertedTokens;
    }
}
