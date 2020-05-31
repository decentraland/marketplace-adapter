const { accounts, contract } = require('@openzeppelin/test-environment');

const {
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MarketFeesCollector = contract.fromArtifact('MarketFeesCollector');
const UniswapV2Converter = contract.fromArtifact('UniswapV2Converter');
const KyberConverter = contract.fromArtifact('KyberConverter');

// Mocks
const UniswapRouterMock = contract.fromArtifact('UniswapRouterMock');
const KyberProxyMock = contract.fromArtifact('KyberProxyMock');

require('chai').should();

describe('MarketFeesCollector', function() {

  const [ owner, someone, someERC20Token, someConverter ] = accounts;

  before(async function () {

    const kyberProxyMock = await KyberProxyMock.new({ from: owner });
    const uniswapRouterMock = await UniswapRouterMock.new({ from: owner });

    this.kyberConverter = await KyberConverter.new(
      someERC20Token, kyberProxyMock.address, { from: owner }
    );

    this.uniswapV2Converter = await UniswapV2Converter.new(
      someERC20Token, uniswapRouterMock.address, { from: owner }
    );

    this.feesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS, { from: owner }
    );
  });

  // Fees collector
  describe('FeesConverter admin', function() {

    it(`emits FeesConverter on succesful set`, async function() {
      const receipt = await this.feesCollector.setConverter(
        someConverter, { from: owner },
      );

      expectEvent(receipt, 'SetConverter', {
        converter: someConverter,
      });
    });

    it(`reverts when setting FeesConverter from non owner account`, async function() {
      await expectRevert(
        this.feesCollector.setConverter(
          someConverter, { from: someone },
        ),
        "Ownable: caller is not the owner"
      );
    });
  });

  //
  describe('Burning collected fees', function() {

    it(`reverts converter unavailable`, async function() {
      await this.feesCollector.setConverter(
        constants.ZERO_ADDRESS, { from: owner },
      );

      await expectRevert(
        this.feesCollector.burnCollectedFees({
          from: someone
        }),
        "MarketFeesCollector: converter unavailable"
      );
    });

    describe('Using Kyber', function() {

      before(async function () {
        this.burningBalance = `${10e18}`;

        await this.feesCollector.send(this.burningBalance);
        await this.feesCollector.setConverter(
          this.kyberConverter.address, { from: owner },
        );
      });

      it(`emits CollectedFeesBurned on success`, async function() {
        const receipt = await this.feesCollector.burnCollectedFees({
          from: someone,
        });

        expectEvent(receipt, 'CollectedFeesBurned', {
          callingAddr: someone,
          etherBalance: this.burningBalance,
          burnedTokens: this.burningBalance,
        });
      });
    });

    describe('Using UniswapV2', function() {

      before(async function () {
        this.burningBalance = `${10e18}`;

        await this.feesCollector.setConverter(
          this.uniswapV2Converter.address, { from: owner },
        );
        await this.feesCollector.send(this.burningBalance);
      });

      it(`emits CollectedFeesBurned on success`, async function() {
        const receipt = await this.feesCollector.burnCollectedFees({
          from: someone
        });

        expectEvent(receipt, 'CollectedFeesBurned', {
          callingAddr: someone,
          etherBalance: this.burningBalance,
          burnedTokens: this.burningBalance, // Mocks returns same amount
        });
      });
    });

  });

});
