const { accounts, contract } = require('@openzeppelin/test-environment')

const {
  BN, // Big Number support
  balance, //
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers')

const MarketFeesCollector = contract.fromArtifact('MarketFeesCollector')
const UniswapV2Converter = contract.fromArtifact('UniswapV2Converter')
const KyberConverter = contract.fromArtifact('KyberConverter')
const ConverterMock = contract.fromArtifact('ConverterMock')

// Mocks
const ERC20MockBase = contract.fromArtifact('ERC20MockBase')
const ERC20MockBurnable = contract.fromArtifact('ERC20MockBurnable')
const KyberProxyMock = contract.fromArtifact('KyberProxyMock')
const UniswapRouterMock = contract.fromArtifact('UniswapRouterMock')

require('chai').should()

describe('MarketFeesCollector', function () {
  const [owner, someone, someConverter, someReserveToken] = accounts

  before(async function () {
    this.converterMock = await ConverterMock.new({ from: owner })
    this.kyberProxyMock = await KyberProxyMock.new({ from: owner })
    this.uniswapRouterMock = await UniswapRouterMock.new({ from: owner })

    // ERC20 Mock
    this.reserveTokenBase = await ERC20MockBase.new({ from: owner })
    this.reserveBurnableToken = await ERC20MockBurnable.new({ from: owner })

    this.kyberConverter = await KyberConverter.new(
      this.kyberProxyMock.address,
      { from: owner }
    )

    this.uniswapV2Converter = await UniswapV2Converter.new(
      this.uniswapRouterMock.address, { from: owner }
    )

    // Fees collector using a non ERC20 burnable() interface as reserve token
    this.feesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS,
      this.reserveTokenBase.address,
      {
        from: owner,
      }
    )

    // Alternative Fees collector for test using a - ERC20 burnable()
    //  interface as reserve token
    this.alternativeFeesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS,
      this.reserveBurnableToken.address,
      {
        from: owner
      }
    )

    //configuredFeesCollector
    this.configuredFeesCollector = this.feesCollector
  })

  // Fees collector management
  describe('FeesConverter admin', function () {
    it('emits FeesConverter on succesful set', async function () {
      const receipt = await this.configuredFeesCollector.setConverter(
        someConverter, { from: owner }
      )

      expectEvent(receipt, 'SetConverter', {
        converter: someConverter,
      })
    })

    it('reverts when setting FeesConverter from non owner account', async function () {
      await expectRevert(
        this.configuredFeesCollector.setConverter(someConverter, { from: someone }),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('Burning collected fees', function () {
    const prepareConverter = async function (context, converter) {
      context.burningBalance = `${1e18}`

      // setConverter() to kyber
      await context.feesCollector.setConverter(
        converter.address, { from: owner }
      )
      await context.alternativeFeesCollector.setConverter(
        converter.address, { from: owner }
      )
    }

    const testForSuccess = async function (context, reserveToken, proxyMock) {

      // send() some ether balance to burn
      await context.configuredFeesCollector.send(
        context.burningBalance
      )

      // mint() burningBalance to the KyberProxyMock
      reserveToken.mint(
        proxyMock.address,
        context.burningBalance
      )

      const receipt = await context.configuredFeesCollector.burnCollectedFees({
        from: someone,
      })

      expectEvent(receipt, 'CollectedFeesBurned', {
        callingAddr: someone,
        etherBalance: context.burningBalance,
        burnedTokens: context.burningBalance,
      })
    }

    it('reverts converter unavailable', async function () {
      await this.configuredFeesCollector.setConverter(constants.ZERO_ADDRESS, {
        from: owner,
      })

      await expectRevert(
        this.configuredFeesCollector.burnCollectedFees({
          from: someone,
        }),
        'MarketFeesCollector: converter unavailable'
      )
    })

    it('reverts if can\'t convert eth > tokens', async function () {
      await this.configuredFeesCollector.setConverter(
        this.converterMock.address, { from: owner })

      await expectRevert(
        this.configuredFeesCollector.burnCollectedFees({
          from: someone,
        }),
        'MarketFeesCollector: conversion error'
      )
    })

    describe('Using Kyber', function () {

      before(async function () {
        await prepareConverter(this, this.kyberConverter)
      })

      it('emits CollectedFeesBurned on success', async function () {
        await testForSuccess(this, this.reserveTokenBase, this.kyberProxyMock)
      })

      describe('Using burn() in the reserveToken', function () {

        before(async function () {
          this.configuredFeesCollector = this.alternativeFeesCollector;
        })

        it('emits CollectedFeesBurned on success', async function () {
          await testForSuccess(
            this,
            this.reserveBurnableToken,
            this.kyberProxyMock
          )
        })

        after(async function () {
          this.configuredFeesCollector = this.feesCollector;
        })

      })

    })

    describe('Using UniswapV2', function () {

      before(async function () {
        await prepareConverter(this, this.uniswapV2Converter)
      })

      it('emits CollectedFeesBurned on success', async function () {
        await testForSuccess(
          this,
          this.reserveTokenBase,
          this.uniswapRouterMock
        )
      })

      describe('Using burn() in the reserveToken', function () {

        before(async function () {
          this.configuredFeesCollector = this.alternativeFeesCollector;
        })

        it('emits CollectedFeesBurned on success', async function () {
          await testForSuccess(
            this,
            this.reserveBurnableToken,
            this.uniswapRouterMock
          )
        })

        after(async function () {
          this.configuredFeesCollector = this.feesCollector;
        })

      })
    })
  })

  describe('Testing receive() method', function () {
    it('checks pre-post balances on successful send', async function () {
      const randomValue = new BN(`{1e18}`);

      const tracker = await balance.tracker(this.feesCollector.address)
      const preBalance = await tracker.get()

      await this.feesCollector.send(randomValue, { from: someone })

      const postBalance = await tracker.get()

      postBalance.should.be.bignumber.eq(
        preBalance.add(randomValue)
      )
    })
  })

})
