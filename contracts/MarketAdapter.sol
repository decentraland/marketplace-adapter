// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


contract MarketAdapter is Ownable, IERC721Receiver {
    using SafeMath for uint;

    event ExecutedOrder(uint assetId, address marketplace, uint orderValue, uint orderFees);

    /// Allowed map of marketplaces
    mapping (address => bool) private whitelistedMarkets;

    /// Order execution fee in a 0-100 basis
    uint public adapterTransactionFee = 0;

    /// Max allowed fee for the adapter
    uint public constant ADAPTER_FEE_MAX = 150;
    uint public constant ADAPTER_FEE_PRECISION = 1000;

    /// MarketFeesCollector address
    address payable public marketFeesCollector;

    /// Mapping of opened orders whating for assets transfer
    /// MarketPlace -> AssetId -> Buyer Address
    mapping (address => mapping(uint => address)) private awaitingReceivers;

    /**
     */
    constructor(address payable _collector) Ownable() public {
        marketFeesCollector = _collector;
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
        public onlyOwner
    {
        whitelistedMarkets[_marketplace] = _action;
    }

    /**
     * @dev Initializer for PerformanceCard contract
     * @param _collector Address for the fees collector
     */
    function setFeesCollector(address payable _collector) public onlyOwner {
        marketFeesCollector = _collector;
    }

    /**
     * @dev Sets the adapter fees taken from every relayed order
     * @param _transactionFee in a 0 to MATH_PRECISION basis
     */
    function setAdapterFee(uint _transactionFee) public onlyOwner {
        require(ADAPTER_FEE_MAX >= _transactionFee, "MarketAdapter: Invalid transaction fee");
        adapterTransactionFee = _transactionFee;
    }

    /**
     * @dev Relays buy marketplace order taking the configured fees from message value.
     * @param _assetId listed asset Id.
     * @param _market whitelisted marketplace listing the asset.
     * @param _encodedCallData encoded buy order to execute on whitelisted marketplace.
     */
    function buy(
        uint _assetId,
        address _market,
        bytes memory _encodedCallData
    )
        public payable
    {
        require(whitelistedMarkets[_market], "MarketAdapter: dest market is not whitelisted");
        require(msg.value > 0, "invalid order value");

        /// Get execution fee from order
        uint totalOrderValue = msg.value;
        uint transactionFee = totalOrderValue
            .mul(adapterTransactionFee)
            .div(ADAPTER_FEE_PRECISION);

        uint relayedOrderValue = totalOrderValue.sub(transactionFee);

        /// Add sender to awaiting receivers mapping.
        awaitingReceivers[_market][_assetId] = msg.sender;

        /// Send order fee to Collector. Reverts on failure
        marketFeesCollector.transfer(transactionFee);

        (bool success, ) = _market.call{
            value: relayedOrderValue
        }(
            _encodedCallData
        );

        require(success, "MarketAdapter: failed to execute transaction order");

        emit ExecutedOrder(_assetId, _market, totalOrderValue, transactionFee);
    }

    /**
     * @dev Called uppon after a ERC721 transfer to this contract.
     *  Rejects transfers from non whitelisted markets.
     */
    function onERC721Received(
        address _market,
        address,
        uint256 _assetId,
        bytes memory
    )
        public virtual override returns (bytes4)
    {
        require(whitelistedMarkets[_market], "onERC721Received: operator is not allowed");
        require(awaitingReceivers[_market][_assetId] != address(0), "onERC721Received: no waiting receiver for this asset");

        /// check if there's a waiting buyer for this asset
        address awaitingReceiver = awaitingReceivers[_market][_assetId];

        /// Remove waiter from mapping
        delete awaitingReceivers[_market][_assetId];

        /// Ask registry to transfer the asset to the final owner
        IERC721(_market).safeTransferFrom(
            address(this), awaitingReceiver, _assetId
        );

        return this.onERC721Received.selector;
    }
}
