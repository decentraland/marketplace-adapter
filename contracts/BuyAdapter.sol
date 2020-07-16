// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ERC721Holder.sol";
import "./ConverterManager.sol";
import "./ITransferableRegistry.sol";

import "./dex/IConverter.sol";


contract BuyAdapter is
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

    event ExecutedOrder(
        address indexed marketplace,
        uint256 orderValue,
        uint256 orderFees,
        bytes marketplaceData
    );

    event MarketplaceAllowance(address indexed marketplace, bool value);
    event FeesCollectorChange(address indexed collector);
    event AdapterFeeChange(uint256 previousFee, uint256 newFee);

    // Allowed tranfer type enum
    enum TransferType { safeTransferFrom, transferFrom, transfer }

    // Order execution fee in a 0 - 1000000 basis
    uint256 public adapterTransactionFee;

    // Max allowed fee for the adapter
    uint256 public constant ADAPTER_FEE_MAX = 150000; // 15%
    uint256 public constant ADAPTER_FEE_PRECISION = 1000000;

    // MarketFeesCollector address
    address payable public adapterFeesCollector;

    /**
     * @dev constructor
     * @param _converter address for the IConverter
     * @param _collector address for the Fee Collector contract
     * @param _adapderFee initial adapter fee
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
            "BuyAdapter: Invalid transaction fee"
        );
        emit AdapterFeeChange(adapterTransactionFee, _transactionFee);
        adapterTransactionFee = _transactionFee;
    }

    /**
     * @dev Relays buy marketplace order. Uses the IConverter to
     *  swap erc20 tokens to ethers and call _buy() with the exact ether amount
     * @param _registry NFT registry address
     * @param _tokenId listed asset Id.
     * @param _marketplace marketplace listing the asset.
     * @param _encodedCallData forwarded to _marketplace.
     * @param _orderAmount (excluding fees) in ethers for the markeplace order
     * @param _paymentToken ERC20 address of the token used to pay
     * @param _maxPaymentTokenAmount max ERC20 token to use. Prevent high splippage.
     * @param _transferType choice for calling the ERC721 registry
     * @param _beneficiary where to send the ERC721 token
     */
    function buy(
        ITransferableRegistry _registry,
        uint256 _tokenId,
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount,
        IERC20 _paymentToken,
        uint256 _maxPaymentTokenAmount,
        TransferType _transferType,
        address _beneficiary
    )
        public nonReentrant
    {
        IConverter converter = IConverter(converterAddress);

        // Calc total needed for this order + adapter fees
        uint256 orderFees = _calcOrderFees(_orderAmount);
        uint256 totalOrderAmount = _orderAmount.add(orderFees);

        // Get amount of srcTokens needed for the exchange
        uint256 paymentTokenAmount = converter.calcNeededTokensForEther(
            _paymentToken,
            totalOrderAmount
        );

        require(
            paymentTokenAmount > 0,
            "BuyAdapter: paymentTokenAmount invalid"
        );

        require(
            paymentTokenAmount <= _maxPaymentTokenAmount,
            "BuyAdapter: paymentTokenAmount > _maxPaymentTokenAmount"
        );

        // Get Tokens from sender
        _paymentToken.safeTransferFrom(
            msg.sender, address(this), paymentTokenAmount
        );

        // allow converter for this paymentTokenAmount transfer
        _paymentToken.safeApprove(converterAddress, paymentTokenAmount);

        // Get ethers from converter
        (uint256 convertedEth, uint256 remainderTokenAmount) = converter.swapTokenToEther(
            _paymentToken,
            paymentTokenAmount,
            totalOrderAmount
        );

        require(
            convertedEth == totalOrderAmount,
            "BuyAdapter: invalid ether amount after conversion"
        );

        if (remainderTokenAmount > 0) {
            _paymentToken.safeTransfer(msg.sender, remainderTokenAmount);
        }

        _buy(
            _registry,
            _tokenId,
            _marketplace,
            _encodedCallData,
            _orderAmount,
            orderFees,
            _transferType,
            _beneficiary
        );
    }

    /**
     * @dev Relays buy marketplace order taking the configured fees
     *  from message value.
     * @param _registry NFT registry address
     * @param _tokenId listed asset Id.
     * @param _marketplace marketplace listing the asset.
     * @param _encodedCallData forwarded to the _marketplace.
     * @param _orderAmount (excluding fees) in ethers for the markeplace order
     * @param _transferType choice for calling the ERC721 registry
     * @param _beneficiary where to send the ERC721 token
     */
    function buy(
        ITransferableRegistry _registry,
        uint256 _tokenId,
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount,
        TransferType _transferType,
        address _beneficiary
    )
        public payable nonReentrant
    {
        // Calc total needed for this order + adapter fees
        uint256 orderFees = _calcOrderFees(_orderAmount);
        uint256 totalOrderAmount = _orderAmount.add(orderFees);

        // Check the order + fees
        require(
            msg.value == totalOrderAmount,
            "BuyAdapter: invalid msg.value != (order + fees)"
        );

        _buy(
            _registry,
            _tokenId,
            _marketplace,
            _encodedCallData,
            _orderAmount,
            orderFees,
            _transferType,
            _beneficiary
        );
    }

    /**
     * @dev Relays buy marketplace order taking the configured fees
     *  from message value.
     *  Notice that this method won't check what was bought. The calldata must have
     *  the desire beneficiry.
     * @param _marketplace marketplace listing the asset.
     * @param _encodedCallData forwarded to the _marketplace.
     * @param _orderAmount (excluding fees) in ethers for the markeplace order
     */
    function buy(
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount
    )
        public payable nonReentrant
    {
        // Calc total needed for this order + adapter fees
        uint256 orderFees = _calcOrderFees(_orderAmount);
        uint256 totalOrderAmount = _orderAmount.add(orderFees);

        // Check the order + fees
        require(
            msg.value == totalOrderAmount,
            "BuyAdapter: invalid msg.value != (order + fees)"
        );

        _buy(
            _marketplace,
            _encodedCallData,
            _orderAmount,
            orderFees
        );
    }

    /**
     * @dev Relays buy marketplace order. Uses the IConverter to
     *  swap erc20 tokens to ethers and call _buy() with the exact ether amount.
     *  Notice that this method won't check what was bought. The calldata must have
     *  the desire beneficiry.
     * @param _marketplace marketplace listing the asset.
     * @param _encodedCallData forwarded to _marketplace.
     * @param _orderAmount (excluding fees) in ethers for the markeplace order
     * @param _paymentToken ERC20 address of the token used to pay
     * @param _maxPaymentTokenAmount max ERC20 token to use. Prevent high splippage.
     */
    function buy(
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount,
        IERC20 _paymentToken,
        uint256 _maxPaymentTokenAmount
    )
        public nonReentrant
    {
        IConverter converter = IConverter(converterAddress);

        // Calc total needed for this order + adapter fees
        uint256 orderFees = _calcOrderFees(_orderAmount);
        uint256 totalOrderAmount = _orderAmount.add(orderFees);

        // Get amount of srcTokens needed for the exchange
        uint256 paymentTokenAmount = converter.calcNeededTokensForEther(
            _paymentToken,
            totalOrderAmount
        );

        require(
            paymentTokenAmount > 0,
            "BuyAdapter: paymentTokenAmount invalid"
        );

        require(
            paymentTokenAmount <= _maxPaymentTokenAmount,
            "BuyAdapter: paymentTokenAmount > _maxPaymentTokenAmount"
        );

        // Get Tokens from sender
        _paymentToken.safeTransferFrom(
            msg.sender, address(this), paymentTokenAmount
        );

        // allow converter for this paymentTokenAmount transfer
        _paymentToken.safeApprove(converterAddress, paymentTokenAmount);

        // Get ethers from converter
        (uint256 convertedEth, uint256 remainderTokenAmount) = converter.swapTokenToEther(
            _paymentToken,
            paymentTokenAmount,
            totalOrderAmount
        );

        require(
            convertedEth == totalOrderAmount,
            "BuyAdapter: invalid ether amount after conversion"
        );

        if (remainderTokenAmount > 0) {
            _paymentToken.safeTransfer(msg.sender, remainderTokenAmount);
        }

        _buy(
            _marketplace,
            _encodedCallData,
            _orderAmount,
            orderFees
        );
    }

    /**
     * @dev Internal call relays the order to a _marketplace.
     * @param _registry NFT registry address
     * @param _tokenId listed asset Id.
     * @param _marketplace marketplace listing the asset.
     * @param _encodedCallData forwarded to _marketplace.
     * @param _orderAmount (excluding fees) in ethers for the markeplace order
     * @param _feesAmount in ethers for the order
     * @param _transferType choice for calling the ERC721 registry
     * @param _beneficiary where to send the ERC721 token
     */
    function _buy(
        ITransferableRegistry _registry,
        uint256 _tokenId,
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount,
        uint256 _feesAmount,
        TransferType _transferType,
        address _beneficiary
    )
        private
    {
        require(_orderAmount > 0, "BuyAdapter: invalid order value");
        require(adapterFeesCollector != address(0), "BuyAdapter: fees Collector must be set");

        // Save contract balance before call to marketplace
        uint256 preCallBalance = address(this).balance;

        // execute buy order in destination marketplace
        (bool success, ) = _marketplace.call{ value: _orderAmount }(
            _encodedCallData
        );

        require(
            success,
            "BuyAdapter: marketplace failed to execute buy order"
        );

        require(
            address(this).balance == preCallBalance.sub(_orderAmount),
            "BuyAdapter: postcall balance mismatch"
        );

        require(
            _registry.ownerOf(_tokenId) == address(this),
            "BuyAdapter: tokenId not transfered"
        );

        // Send balance to Collector. Reverts on failure
        require(
            adapterFeesCollector.send(address(this).balance),
            "BuyAdapter: error sending fees to collector"
        );

        // Transfer tokenId to caller
        _transferItem(
            _registry,
            _tokenId,
            _transferType,
            _beneficiary
        );

        // Log succesful executed order
        emit ExecutedOrder(
            address(_registry),
            _tokenId,
            _marketplace,
            _orderAmount,
            _feesAmount
        );
    }

    /**
     * @dev Internal call relays the order to a _marketplace.
     *  Notice that this method won't check what was bought. The calldata must have
     *  the desire beneficiry.
     * @param _marketplace marketplace listing the asset.
     * @param _encodedCallData forwarded to _marketplace.
     * @param _orderAmount (excluding fees) in ethers for the markeplace order
     * @param _feesAmount in ethers for the order
     */
    function _buy(
        address _marketplace,
        bytes memory _encodedCallData,
        uint256 _orderAmount,
        uint256 _feesAmount
    )
        private
    {
        require(_orderAmount > 0, "BuyAdapter: invalid order value");
        require(adapterFeesCollector != address(0), "BuyAdapter: fees Collector must be set");

        // Save contract balance before call to marketplace
        uint256 preCallBalance = address(this).balance;

        // execute buy order in destination marketplace
        (bool success, ) = _marketplace.call{ value: _orderAmount }(
            _encodedCallData
        );

        require(
            success,
            "BuyAdapter: marketplace failed to execute buy order"
        );

        require(
            address(this).balance == preCallBalance.sub(_orderAmount),
            "BuyAdapter: postcall balance mismatch"
        );

        // Send balance to Collector. Reverts on failure
        require(
            adapterFeesCollector.send(address(this).balance),
            "BuyAdapter: error sending fees to collector"
        );

        // Log succesful executed order
        emit ExecutedOrder(
            _marketplace,
            _orderAmount,
            _feesAmount,
            _encodedCallData
        );
    }

    /**
     * @dev Transfer the NFT to the final owner
     * @param _registry NFT registry address
     * @param _tokenId listed token Id.
     * @param _transferType choice for calling the ERC721 registry
     * @param _beneficiary where to send the ERC721 token
     */
    function _transferItem(
        ITransferableRegistry _registry,
        uint256 _tokenId,
        TransferType _transferType,
        address _beneficiary
    )
        private
    {
        require(_beneficiary != address(this), "BuyAdapter: invalid beneficiary");

        if (_transferType == TransferType.safeTransferFrom) {
            _registry.safeTransferFrom(address(this), _beneficiary, _tokenId);

        } else if (_transferType == TransferType.transferFrom) {
            _registry.transferFrom(
                address(this),
                _beneficiary,
                _tokenId
            );

        } else if (_transferType == TransferType.transfer) {
            _registry.transfer(
                _beneficiary,
                _tokenId
            );

        } else {
            revert('BuyAdapter: Unsopported transferType');
        }

        require(
            _registry.ownerOf(_tokenId) == _beneficiary,
            "BuyAdapter: error with asset transfer"
        );
    }

    /**
     * @param _orderAmount item value as in the NFT marketplace
     * @return adapter fees from total order value
     */
    function _calcOrderFees(uint256 _orderAmount) private view returns (uint256) {
        return _orderAmount
            .mul(adapterTransactionFee)
            .div(ADAPTER_FEE_PRECISION);
    }

    receive() external payable {
        require(msg.sender != tx.origin, "BuyAdapter: sender invalid");
    }
}
