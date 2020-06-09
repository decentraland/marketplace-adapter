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

    this.kyberProxyMock = await KyberProxyMock.new({ from: owner });
    this.uniswapRouterMock = await UniswapRouterMock.new({ from: owner });

    // ERC20 Mock
    this.reserveTokenBase = await ERC20MockBase.new({ from: owner });
    this.reserveBurnableToken = await ERC20MockBurnable.new({ from: owner });

    this.kyberConverter = await KyberConverter.new(
      this.kyberProxyMock.address, { from: owner }
    );

    this.uniswapV2Converter = await UniswapV2Converter.new(
      this.uniswapRouterMock.address, { from: owner }
    );


    this.feesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS,
      constants.ZERO_ADDRESS, {
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

    prepareConverter = async function (context, converter) {
      context.burningBalance = `${1e18}`;

      // setConverter() to kyber
      await context.feesCollector.setConverter(
        converter.address, { from: owner },
      );
    }

    testForSuccess = async function (context, reserveToken, proxyMock) {

      // set reserve token type in FeesCollector
      await context.feesCollector.setReserveToken(
        reserveToken.address, { from: owner }
      );

      // send() some ether balance to burn
      await context.feesCollector.send(context.burningBalance);

      // mint() burningBalance to the KyberProxyMock
      reserveToken.mint(
        proxyMock.address,
        context.burningBalance,
      )

      const receipt = await context.feesCollector.burnCollectedFees({
        from: someone,
      });

      expectEvent(receipt, 'CollectedFeesBurned', {
        callingAddr: someone,
        burnedToken: reserveToken.address,
        etherBalance: context.burningBalance,
        burnedTokens: context.burningBalance,
      });
    }

    it(`reverts converter unavailable`, async function () {
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

    describe('Using Kyber', function () {

      before(async function () {
        await prepareConverter(this, this.kyberConverter);
      });

      it(`emits CollectedFeesBurned on success`, async function() {
        await testForSuccess(
          this,
          this.reserveTokenBase,
          this.kyberProxyMock,
        );
      });

      it(`emits CollectedFeesBurned on success :: calling ERC20 burn() interface`, async function() {
        await testForSuccess(
          this,
          this.reserveBurnableToken,
          this.kyberProxyMock,
        );
      });
    });

    describe('Using UniswapV2', function() {

      before(async function () {
        await prepareConverter(this, this.uniswapV2Converter);
      });

      it(`emits CollectedFeesBurned on success`, async function() {
        await testForSuccess(
          this,
          this.reserveTokenBase,
          this.uniswapRouterMock,
        );
      });

      it(`emits CollectedFeesBurned on success :: calling ERC20 burn() interface`, async function() {
        await testForSuccess(
          this,
          this.reserveBurnableToken,
          this.uniswapRouterMock,
        );
      });
    });
  });
});
