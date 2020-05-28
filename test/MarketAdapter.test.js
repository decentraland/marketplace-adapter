const { accounts, contract } = require('@openzeppelin/test-environment');

const {
  // BN,           // Big Number support
  // constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MarketAdapter = contract.fromArtifact('MarketAdapter');

require('chai').should();

describe('MarketAdapter', function() {

  const [ owner, someone, marketplaceAddr, feesCollector ] = accounts;

  beforeEach(async function () {
    this.contract = await MarketAdapter.new(
      feesCollector, { from: owner }
    );
  });

  // Marketplace whitelisting

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

  // Fees collector

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

  /// Adapter fee changes

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
