const { accounts, contract } = require('@openzeppelin/test-environment');

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MarketAdapter = contract.fromArtifact('MarketAdapter');
const MarketFeesCollector = contract.fromArtifact('MarketFeesCollector');

// Load Mocks
const MarketplaceMock = contract.fromArtifact('MarketplaceMock');
const ERC721Mock = contract.fromArtifact('ERC721Mock');

require('chai').should();

describe('MarketAdapter', function() {

  const [ owner, someone, nonWhitelistedMarket ] = accounts;

  before(async function () {
    // create a mock marketplace and assing a mock token
    this.marketplaceMock = await MarketplaceMock.new({ from: owner });

    // create a mock registry and mint tokenId to marketplace
    this.erc721RegistryMock = await ERC721Mock.new({ from: owner });

    // Create a marketplace adapter
    this.marketAdapter = await MarketAdapter.new(
      constants.ZERO_ADDRESS, { from: owner }
    );

    // Create a Fees Collector
    this.marketFeesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS, { from: owner }
    )
  });

  // Marketplace whitelisting
  describe('Markets whitelisting admin', function() {

    it(`emits MarketplaceAllowance on successful whitelist`, async function() {
      const receipt = await this.marketAdapter.setMarketplaceAllowance(
        this.marketplaceMock.address, true, { from: owner },
      );

      expectEvent(receipt, 'MarketplaceAllowance', {
        marketplace: this.marketplaceMock.address,
        value: true,
      });
    });

    it(`reverts when whitelisting from non owner account`, async function() {
      await expectRevert(
        this.marketAdapter.setMarketplaceAllowance(
          this.marketplaceMock.address, true, { from: someone }
        ),
        "Ownable: caller is not the owner"
      );
    });

  });

  // Fees collector
  describe('FeesCollector admin', function() {

    it(`emits FeesCollectorChange on succesful set`, async function() {
      const receipt = await this.marketAdapter.setFeesCollector(
        this.marketFeesCollector.address, { from: owner },
      );

      expectEvent(receipt, 'FeesCollectorChange', {
        collector: this.marketFeesCollector.address,
      });
    });

    it(`reverts when setting FeesCollector from non owner account`, async function() {
      await expectRevert(
        this.marketAdapter.setFeesCollector(
          this.marketFeesCollector.address, { from: someone },
        ),
        "Ownable: caller is not the owner"
      );
    });
  });

  // Adapter fee changes
  describe('Adapter fee admin', function() {

    it(`emits AdapterFeeChange on succesful set`, async function() {
      const adapterFee = 1000;
      const receipt = await this.marketAdapter.setAdapterFee(
        adapterFee, { from: owner },
      );

      expectEvent(receipt, 'AdapterFeeChange', {
        previousFee: '0',
        newFee: '1000',
      });
    });

    it(`reverts when setting AdapterFee from non owner account`, async function() {
      const adapterFee = 100;
      await expectRevert(
        this.marketAdapter.setAdapterFee(
          adapterFee, { from: someone },
        ),
        "Ownable: caller is not the owner"
      );
    });

    it(`reverts when setting AdapterFee > ADAPTER_FEE_MAX`, async function() {
      const maxAllowedFee = await this.marketAdapter.ADAPTER_FEE_MAX();
      await expectRevert(
        this.marketAdapter.setAdapterFee(
          maxAllowedFee + 1, { from: owner },
        ),
        "MarketAdapter: Invalid transaction fee"
      );
    });
  });

  // Buy method
  describe('Calling buy_adapter()', function() {

    before(async function() {
      // Mint tokens to marketplace
      for (const tokenId of ['1000', '2000', '3000']) {
        await this.erc721RegistryMock.mint(
          this.marketplaceMock.address, tokenId,
        );
      }

      // Get configured Fees and FeeBasis
      const [ marketFee, marketFeeBasis ] = await Promise.all([
        this.marketAdapter.adapterTransactionFee(),
        this.marketAdapter.ADAPTER_FEE_PRECISION(),
      ]);

      // Set order Value and fees
      this.orderValue = new BN(`${1e18}`);
      this.orderFees = this.orderValue
        .mul(marketFee)
        .div(marketFeeBasis);
    });

    it(`emits ExecutedOrder with onERC721Received callback`, async function() {

      const tokenId = '1000';

      // encode buy(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buy(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      const receipt = await this.marketAdapter.buy(
        this.erc721RegistryMock.address,
        tokenId,
        this.marketplaceMock.address,
        encodedCallData, {
          value: this.orderValue,
          from: someone,
        },
      );

      expectEvent(receipt, 'ExecutedOrder', {
        registry: this.erc721RegistryMock.address,
        tokenId: tokenId,
        marketplace: this.marketplaceMock.address,
        orderValue: this.orderValue,
        orderFees: this.orderFees,
      });
    });

    it(`emits ExecutedOrder without onERC721Received callback`, async function() {

      const tokenId = '2000';

      // encode buyAlt(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buyAlt(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      const receipt = await this.marketAdapter.buy(
        this.erc721RegistryMock.address,
        tokenId,
        this.marketplaceMock.address,
        encodedCallData, {
          value: this.orderValue,
          from: someone,
        },
      );

      expectEvent(receipt, 'ExecutedOrder', {
        registry: this.erc721RegistryMock.address,
        tokenId: tokenId,
        marketplace: this.marketplaceMock.address,
        orderValue: this.orderValue,
        orderFees: this.orderFees,
      });
    });

    it(`reverts non-whitelisted marketplace`, async function() {
      const tokenId = '3000';

      // encode buy(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buy(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      await expectRevert(
        this.marketAdapter.buy(
          this.erc721RegistryMock.address,
          tokenId,
          nonWhitelistedMarket, // not whitelisted
          encodedCallData, {
            value: this.orderValue,
            from: someone,
          },
        ),
        "MarketAdapter: dest market is not whitelisted"
      );
    });

    it(`reverts msg.value invalid`, async function() {
      const tokenId = '3000';

      // encode buy(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buy(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      await expectRevert(
        this.marketAdapter.buy(
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData, {
            value: 0, // invalid order value
            from: someone,
          },
        ),
        "MarketAdapter: invalid order value"
      );
    });

    it(`reverts failed to execute order`, async function() {
      const tokenId = '3000';

      // encode buyRevert(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buyRevert(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      await expectRevert(
        this.marketAdapter.buy(
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData, {
            value: this.orderValue,
            from: someone,
          },
        ),
        "MarketAdapter: marketplace failed to execute buy order"
      );
    });

    /*
     * MarketAdapter does not implements receive() nor fallback()
     * We're testing case using selfdestruct() in the destination of the call
     * very weird case.
     */
    it(`reverts balance mistmach on refund`, async function() {
      const tokenId = '3000';

      // encode buyRefund(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buyRefund(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      await expectRevert(
        this.marketAdapter.buy(
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData, {
            value: this.orderValue,
            from: someone,
          },
        ),
        "MarketAdapter: postcall balance mismatch"
      );
    });

    it(`reverts token not transfered`, async function() {
      const tokenId = '3000';

      // encode buyNotTransfer(_tokenId, _registry) for calling the marketplace mock
      const encodedCallData = this.marketplaceMock.contract.methods.buyNotTransfer(
        tokenId,
        this.erc721RegistryMock.address,
      ).encodeABI();

      await expectRevert(
        this.marketAdapter.buy(
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData, {
            value: this.orderValue,
            from: someone,
          },
        ),
        "MarketAdapter: tokenId not transfered"
      );
    });

  });
});
