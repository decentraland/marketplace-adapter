// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ERC721Holder.sol";
import "./ConverterManager.sol";

import "./dex/IConverter.sol";


contract MarketAdapter is
    Ownable,
    ReentrancyGuard,
    ERC721Holder,
    ConverterManager
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event ExecutedOrder(
        address indexed registry,
        uint256 indexed tokenId,
        address indexed marketplace,
        uint256 orderValue,
        uint256 orderFees
    );

    event MarketplaceAllowance(address indexed marketplace, bool value);
    event FeesCollectorChange(address indexed collector);
    event AdapterFeeChange(uint256 previousFee, uint256 newFee);

    // Allowed map of marketplaces
    mapping (address => bool) public whitelistedMarkets;

    // Order execution fee in a 0 - 1000000 basis
    uint256 public adapterTransactionFee;

    // Max allowed fee for the adapter
    uint256 public constant ADAPTER_FEE_MAX = 150000; // 15%
    uint256 public constant ADAPTER_FEE_PRECISION = 1000000;

    // MarketFeesCollector address
    address payable public adapterFeesCollector;

    //
    address private allowedEthSender;

    /**
     * @dev constructor
     * @param _collector address of the Fee Collector
     */
    constructor(
        address _converter,
        address payable _collector,
        uint256 _adapderFee
    )
        Ownable() public
    {
        setConverter(_converter);
        setFeesCollector(_collector);

        setAdapterFee(_adapderFee);
    }

    function setConverter(address _converter) public override onlyOwner {

        // set allowed eth sender from this converter
        if (_converter != address(0)) {
            allowedEthSender = IConverter(_converter).getTrader();

        } else {
            delete allowedEthSender;
        }

        super.setConverter(_converter);
    }


    /**
     * @dev Sets whitelisting status for a marketplace
     * @param _marketplace address
     * @param _action true if allowed, false otherwise
     */
    function setMarketplaceAllowance(
        address _marketplace,
        bool _action
    )
        external onlyOwner
    {
        whitelistedMarkets[_marketplace] = _action;
        emit MarketplaceAllowance(_marketplace, _action);
    }

    /**
     * @dev Sets fees collector for the adapter
     * @param _collector Address for the fees collector
     */
    function setFeesCollector(address payable _collector) public onlyOwner {
        adapterFeesCollector = _collector;
        emit FeesCollectorChange(_collector);
    }

    /**
     * @dev Sets the adapter fees taken from every relayed order
     * @param _transactionFee in a 0 - ADAPTER_FEE_MAX basis
     */
    function setAdapterFee(uint256 _transactionFee) public onlyOwner {
        require(
            ADAPTER_FEE_MAX >= _transactionFee,
            "MarketAdapter: Invalid transaction fee"
        );
        emit AdapterFeeChange(adapterTransactionFee, _transactionFee);
        adapterTransactionFee = _transactionFee;
    }

    /**
     * @dev Relays buy marketplace order. Uses the IConverter to
     *  swap erc20 tokens to ethers and call _buy() with the exact ether amount
     * @param _orderAmount (including fees) in ethers for the markeplace order
     * @param _paymentToken ERC20 address of the token used to pay
     * @param _registry NFT registry address
     * @param _tokenId listed asset Id.
     * @param _marketplace whitelisted marketplace listing the asset.
     * @param _encodedCallData forwarded to whitelisted marketplace.
     */
    function buy(
        IERC721 _registry,
        uint256 _tokenId,
        address _marketplace,
        bytes calldata _encodedCallData,
        uint256 _orderAmount,
        IERC20 _paymentToken
    )
        external nonReentrant
    {
        IConverter converter = IConverter(converterAddress);

        uint256 paymentTokenAmount = converter.calcEtherToToken(
            _paymentToken,
            _orderAmount
        );

        require(paymentTokenAmount > 0, "MarketAdapter: payment token amount invalid");
        require(
            _paymentToken.balanceOf(msg.sender) >= paymentTokenAmount,
            "MarketAdapter: insufficient payment token balance"
        );

        // Get Tokens from registry
        _paymentToken.safeTransferFrom(
            msg.sender,
            address(this),
            paymentTokenAmount
        );

        // Aprove converter for this paymentTokenAmount transfer
        _paymentToken.safeApprove(converterAddress, paymentTokenAmount);

        // Get ethers from converter
        converter.swapTokenToEther(_paymentToken, paymentTokenAmount);

        _buy(
            _registry,
            _tokenId,
            _marketplace,
            _encodedCallData,
            _orderAmount
        );
    }

    /**
     * @dev Relays buy marketplace order taking the configured fees
     *  from message value.
     * @param _registry NFT registry address
     * @param _tokenId listed asset Id.
     * @param _marketplace whitelisted marketplace listing the asset.
     * @param _encodedCallData forwarded to whitelisted marketplace.
     */
    function buy(
        IERC721 _registry,
        uint256 _tokenId,
        address _marketplace,
        bytes calldata _encodedCallData
    )
        external payable nonReentrant
    {
        _buy(
            _registry,
            _tokenId,
            _marketplace,
            _encodedCallData,
            msg.value
        );
    }

    function _buy(
        IERC721 _registry,
        uint256 _tokenId,
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount
    )
        private
    {
        require(_orderAmount > 0, "MarketAdapter: invalid order value");

        require(
            whitelistedMarkets[_marketplace],
            "MarketAdapter: dest market is not whitelisted"
        );

        // Get adapter fees from total order value
        uint256 transactionFee = _orderAmount
            .mul(adapterTransactionFee)
            .div(ADAPTER_FEE_PRECISION);

        uint256 relayedOrderValue = _orderAmount.sub(transactionFee);

        // Save contract balance before call to marketplace
        uint256 preCallBalance = address(this).balance;

        // execute buy order in destination marketplace
        (bool success, ) = _marketplace.call{ value: relayedOrderValue }(
            _encodedCallData
        );

        require(success, "MarketAdapter: marketplace failed to execute buy order");

        require(
            address(this).balance == preCallBalance.sub(relayedOrderValue),
            "MarketAdapter: postcall balance mismatch"
        );

        require(
            _registry.ownerOf(_tokenId) == address(this),
            "MarketAdapter: tokenId not transfered"
        );

        // Send balance to Collector. Reverts on failure
        if (adapterFeesCollector != address(0) && address(this).balance > 0) {
            require(
                adapterFeesCollector.send(address(this).balance),
                "MarketAdapter: error sending fees to collector"
            );
        }

        // Transfer tokenId to caller
        _registry.safeTransferFrom(
            address(this), msg.sender, _tokenId
        );

        // Log succesful executed order
        emit ExecutedOrder(
            address(_registry),
            _tokenId,
            _marketplace,
            _orderAmount,
            transactionFee
        );
    }

    receive() external payable {
        require(
            msg.sender == allowedEthSender, "MarketAdapter: sender invalid"
        );
    }
}
