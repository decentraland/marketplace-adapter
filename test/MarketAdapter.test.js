const { accounts, contract } = require('@openzeppelin/test-environment');

const {
  // BN,           // Big Number support
  // constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MarketAdapter = contract.fromArtifact('MarketAdapter');

// Load Mocks
const MarketplaceMock = contract.fromArtifact('MarketplaceMock');
const ERC721Mock = contract.fromArtifact('ERC721Mock');

require('chai').should();

describe('MarketAdapter', function() {

  const [ owner, someone, marketplaceAddr, feesCollector ] = accounts;

  beforeEach(async function () {
    this.contract = await MarketAdapter.new(
      feesCollector, { from: owner }
    );
  });

  // Marketplace whitelisting
  describe('Markets whitelisting admin', function() {

    it(`emits MarketplaceAllowance on successful whitelist`, async function() {
      const receipt = await this.contract.setMarketplaceAllowance(
        marketplaceAddr, true, { from: owner },
      );

      expectEvent(receipt, 'MarketplaceAllowance', {
        marketplace: marketplaceAddr,
        value: true,
      });
    });

    it(`reverts when whitelisting from non owner account`, async function() {
      await expectRevert(
        this.contract.setMarketplaceAllowance(
          marketplaceAddr, true, { from: someone }
        ),
        "Ownable: caller is not the owner"
      );
    });

  });

  // Fees collector
  describe('FeesCollector admin', function() {

    it(`emits FeesCollectorChange on succesful set`, async function() {
      const receipt = await this.contract.setFeesCollector(
        feesCollector, { from: owner },
      );

      expectEvent(receipt, 'FeesCollectorChange', {
        collector: feesCollector,
      });
    });

    it(`reverts when setting FeesCollector from non owner account`, async function() {
      await expectRevert(
        this.contract.setFeesCollector(
          feesCollector, { from: someone },
        ),
        "Ownable: caller is not the owner"
      );
    });
  });

  // Adapter fee changes
  describe('Adapter fee admin', function() {

    it(`emits AdapterFeeChange on succesful set`, async function() {
      const adapterFee = 100;
      const receipt = await this.contract.setAdapterFee(
        adapterFee, { from: owner },
      );

      expectEvent(receipt, 'AdapterFeeChange', {
        previousFee: '0',
        newFee: '100',
      });
    });

    it(`reverts when setting AdapterFee from non owner account`, async function() {
      const adapterFee = 100;
      await expectRevert(
        this.contract.setAdapterFee(
          adapterFee, { from: someone },
        ),
        "Ownable: caller is not the owner"
      );
    });

    it(`reverts when setting AdapterFee > ADAPTER_FEE_MAX`, async function() {
      const maxAllowedFee = await this.contract.ADAPTER_FEE_MAX();
      await expectRevert(
        this.contract.setAdapterFee(
          maxAllowedFee + 1, { from: owner },
        ),
        "MarketAdapter: Invalid transaction fee"
      );
    });
  });

  // Buy method
  describe('Calling buy_adapter()', function() {

    beforeEach(async function () {
      this.tokenIdMock = 2000;

      // create a mock marketplace and assing a mock token
      this.marketplaceMock = await MarketplaceMock.new({ from: owner });

      // create a mock registry and mint tokenId to marketplace
      this.erc721RegistryMock = await ERC721Mock.new(
        this.marketplaceMock.address,
        this.tokenIdMock, {
          from: owner,
        },
      );
    });

    it(`emits ExecutedOrder with onERC721Received callback`, async function() {

      // const orderValue = 1e18;
      // const orderMarketFees = ;

      // // encode buy(_tokenId, _registry) for calling the marketplace mock

      // const encodedCallData = this.marketplaceMock.buy(
      //   this.tokenIdMock,
      //   this.erc721RegistryMock,
      // ).encodeABI();

      // const receipt = await this.contract.buy_adapter(
      //   this.erc721RegistryMock,
      //   this.tokenIdMock,
      //   this.marketplaceMock,
      //   encodedCallData, {
      //     value:
      //     from: someone
      //   },
      // );

      // expectEvent(receipt, 'ExecutedOrder', {
      //   registry: ,
      //   tokenId: ,
      //   marketplace: ,
      //   orderValue: ,
      //   orderFees: ,
      // });
    });

    // it(`emits ExecutedOrder without onERC721Received callback`, async function() {
    //   const adapterFee = 100;

    //   const receipt = await this.contract.buy_adapter(
    //     adapterFee, { from: someone },
    //   );

    //   expectEvent(receipt, 'ExecutedOrder', {
    //     registry: ,
    //     tokenId: ,
    //     marketplace: ,
    //     orderValue: ,
    //     orderFees: ,
    //   });
    // });

    // it(`reverts non-whitelisted marketplace`, async function() {
    // });

    // it(`reverts msg.value invalid`, async function() {
    // });

    // it(`reverts msg.value invalid`, async function() {
    // });

    // it(`reverts unsuccesfull marketplace call`, async function() {
    // });

    // it(`reverts token not transfered`, async function() {
    // });

  });
});
