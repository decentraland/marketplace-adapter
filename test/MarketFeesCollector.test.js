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
const ERC20MockBase = contract.fromArtifact('ERC20MockBase');
const ERC20MockBurnable = contract.fromArtifact('ERC20MockBurnable');
const KyberProxyMock = contract.fromArtifact('KyberProxyMock');
const UniswapRouterMock = contract.fromArtifact('UniswapRouterMock');

require('chai').should();

describe('MarketFeesCollector', function() {

  const [ owner, someone, someConverter, someReserveToken ] = accounts;

  before(async function () {

    const kyberProxyMock = await KyberProxyMock.new({ from: owner });
    const uniswapRouterMock = await UniswapRouterMock.new({ from: owner });

    // ERC20 Mock
    this.reserveTokenBase = await ERC20MockBase.new({ from: owner });
    this.reserveBurnableToken = await ERC20MockBurnable.new({ from: owner });

    this.kyberConverter = await KyberConverter.new(
      kyberProxyMock.address, { from: owner }
    );

    this.uniswapV2Converter = await UniswapV2Converter.new(
      uniswapRouterMock.address, { from: owner }
    );


    this.feesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS,
      this.reserveTokenBase.address, {
        from: owner
      }
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

    it(`emits ReserveTokenChanged on succesful set`, async function() {
      const receipt = await this.feesCollector.setReserveToken(
        this.reserveTokenBase.address, { from: owner },
      );

      expectEvent(receipt, 'ReserveTokenChanged', {
        token: this.reserveTokenBase.address,
      });
    });

    it(`reverts when setting setReserveToken from non owner account`, async function() {
      await expectRevert(
        this.feesCollector.setReserveToken(
          someReserveToken, { from: someone },
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

        await this.reserveTokenBase.mint(
          this.feesCollector.address,
          this.burningBalance
        );

        const receipt = await this.feesCollector.burnCollectedFees({
          from: someone,
        });

        console.log( await this.feesCollector.reserveToken() );

        expectEvent(receipt, 'CollectedFeesBurned', {
          callingAddr: someone,
          burnedToken: this.reserveTokenBase.address,
          etherBalance: this.burningBalance,
          burnedTokens: this.burningBalance,
        });
      });

      it(`emits CollectedFeesBurned on success :: calling ERC20 burn() interface`, async function() {

        // mints burningBalance to feesCollector.
        await this.reserveBurnableToken.mint(
          this.feesCollector.address,
          this.burningBalance
        );

        // change reserve to burnable
        await this.feesCollector.setReserveToken(
          this.reserveBurnableToken.address, { from: owner },
        );

        const receipt = await this.feesCollector.burnCollectedFees({
          from: someone,
        });

        expectEvent(receipt, 'CollectedFeesBurned', {
          callingAddr: someone,
          burnedToken: this.reserveBurnableToken.address,
          etherBalance: this.burningBalance,
          burnedTokens: this.burningBalance,
        });
      });
    });

    describe('Using UniswapV2', function() {

      before(async function () {
        this.burningBalance = `${10e18}`;

        await this.feesCollector.send(this.burningBalance);
        await this.feesCollector.setConverter(
          this.uniswapV2Converter.address, { from: owner },
        );
      });

      it(`emits CollectedFeesBurned on success`, async function() {

        // mints burningBalance to feesCollector.
        await this.reserveTokenBase.mint(
          this.feesCollector.address,
          this.burningBalance
        );

        const receipt = await this.feesCollector.burnCollectedFees({
          from: someone
        });

        expectEvent(receipt, 'CollectedFeesBurned', {
          callingAddr: someone,
          burnedToken: this.reserveTokenBase.address,
          etherBalance: this.burningBalance,
          burnedTokens: this.burningBalance, // Mocks returns same amount
        });
      });

      it(`emits CollectedFeesBurned on success :: calling ERC20 burn() interface`, async function() {

        // mints burningBalance to feesCollector.
        await this.reserveBurnableToken.mint(
          this.feesCollector.address,
          this.burningBalance
        );

        // change reserve to burnable
        await this.feesCollector.setReserveToken(
          this.reserveBurnableToken.address, { from: owner },
        );

        const receipt = await this.feesCollector.burnCollectedFees({
          from: someone,
        });

        expectEvent(receipt, 'CollectedFeesBurned', {
          callingAddr: someone,
          burnedToken: this.reserveBurnableToken.address,
          etherBalance: this.burningBalance,
          burnedTokens: this.burningBalance,
        });
      });
    });
  });
});
