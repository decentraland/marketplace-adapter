const { accounts, contract } = require('@openzeppelin/test-environment');

const {
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MarketFeesCollector = contract.fromArtifact('MarketFeesCollector');

require('chai').should();

describe('MarketFeesCollector', function() {

  const [ owner, someone, ERC20Token ] = accounts;

  beforeEach(async function () {
    this.contract = await MarketFeesCollector.new({ from: owner });
  });

  //
  describe('', function() {

    it(`emits CollectedFeesBurned on success swap`, async function() {
    });

    it(`reverts when non completed`, async function() {
    });
  });

});
