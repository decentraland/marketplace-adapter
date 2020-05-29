// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


contract MarketAdapter is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeMath for uint256;

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
    mapping (address => bool) private whitelistedMarkets;

    // Order execution fee in a 0 - 1000 basis
    uint256 public adapterTransactionFee = 0;

    // Max allowed fee for the adapter
    uint256 public constant ADAPTER_FEE_MAX = 150000; // 15%
    uint256 public constant ADAPTER_FEE_PRECISION = 1000000;

    // MarketFeesCollector address
    address payable public adapterFeesCollector;

    /**
     * @dev constructor
     * @param _collector address of the Fee Collector
     */
    constructor(address payable _collector) Ownable() public {
        adapterFeesCollector = _collector;
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
        emit MarketplaceAllowance(_marketplace, _action);
    }

    function isMarketplaceAllowed(address _marketplace) public view returns (bool) {
        return whitelistedMarkets[_marketplace];
    }

    /**
     * @dev Initializer for PerformanceCard contract
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
        bytes memory _encodedCallData
    )
        public payable nonReentrant
    {
        require(
            whitelistedMarkets[_marketplace],
            "MarketAdapter: dest market is not whitelisted"
        );

        require(msg.value > 0, "MarketAdapter: invalid order value");

        // Get adapter fees from total order value
        uint256 totalOrderValue = msg.value;
        uint256 transactionFee = totalOrderValue
            .mul(adapterTransactionFee)
            .div(ADAPTER_FEE_PRECISION);

        uint256 relayedOrderValue = totalOrderValue.sub(transactionFee);

        // Save contract balance before call to marketplace
        uint256 preCallBalance = address(this).balance;

        // execute buy order in destination marketplace
        (bool success, ) = _marketplace.call{
            value: relayedOrderValue
        }(
            _encodedCallData
        );

        require(success, "MarketAdapter: failed to execute buy order");

        require(
            address(this).balance == preCallBalance.sub(relayedOrderValue),
            "MarketAdapter: postcall balance mismatch"
        );

        require(
            _registry.ownerOf(_tokenId) == address(this),
            "MarketAdapter: tokenId not transfered"
        );

        // Send order fee to Collector. Reverts on failure
        if (adapterFeesCollector != address(0)) {
            adapterFeesCollector.transfer(
                transactionFee.add(address(this).balance)
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
            totalOrderValue,
            transactionFee
        );
    }

    /**
     * @dev Called uppon after a ERC721 transfer to this contract.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    )
        public virtual override returns (bytes4)
    {
        return this.onERC721Received.selector;
    }
}
