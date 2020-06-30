const { accounts, contract } = require('@openzeppelin/test-environment')

const {
  BN, // Big Number support
  balance, // Balance utils
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers')

const MarketAdapter = contract.fromArtifact('MarketAdapter')
const KyberConverter = contract.fromArtifact('KyberConverter')
const UniswapV2Converter = contract.fromArtifact('UniswapV2Converter')
const MarketFeesCollector = contract.fromArtifact('MarketFeesCollector')

// Load Mocks

const ERC721Mock = contract.fromArtifact('ERC721Mock')
const ERC20MockBase = contract.fromArtifact('ERC20MockBase')
const KyberProxyMock = contract.fromArtifact('KyberProxyMock')
const UniswapRouterMock = contract.fromArtifact('UniswapRouterMock')
const MarketplaceMock = contract.fromArtifact('MarketplaceMock')
const NonReceiverMock = contract.fromArtifact('NonReceiverMock')

require('chai').should()

describe('MarketAdapter', function () {
  const [owner, someone, nonWhitelistedMarket] = accounts

  before(async function () {
    // create a test ERC20 for the payments
    this.reserveTokenMock = await ERC20MockBase.new({ from: owner })

    // create a mock marketplace and assing a mock token
    this.marketplaceMock = await MarketplaceMock.new({ from: owner })

    // create a mock registry and mint tokenId to marketplace
    this.erc721RegistryMock = await ERC721Mock.new({ from: owner })

    // Create a marketplace adapter
    this.marketAdapterFees = 0
    this.marketAdapter = await MarketAdapter.new(
      constants.ZERO_ADDRESS,
      constants.ZERO_ADDRESS,
      this.marketAdapterFees,
      {
        from: owner,
      }
    )

    // Create a Fees Collector
    this.marketFeesCollector = await MarketFeesCollector.new(
      constants.ZERO_ADDRESS,
      constants.ZERO_ADDRESS,
      {
        from: owner,
      }
    )
  })

  // Marketplace whitelisting
  describe('Markets whitelisting admin', function () {
    it('emits MarketplaceAllowance on successful whitelist', async function () {
      const receipt = await this.marketAdapter.setMarketplaceAllowance(
        this.marketplaceMock.address,
        true,
        { from: owner }
      )

      expectEvent(receipt, 'MarketplaceAllowance', {
        marketplace: this.marketplaceMock.address,
        value: true,
      })
    })

    it('reverts when whitelisting from non owner account', async function () {
      await expectRevert(
        this.marketAdapter.setMarketplaceAllowance(
          this.marketplaceMock.address,
          true,
          { from: someone }
        ),
        'Ownable: caller is not the owner'
      )
    })
  })

  // Fees collector
  describe('FeesCollector admin', function () {
    it('emits FeesCollectorChange on succesful set', async function () {
      const receipt = await this.marketAdapter.setFeesCollector(
        this.marketFeesCollector.address,
        { from: owner }
      )

      expectEvent(receipt, 'FeesCollectorChange', {
        collector: this.marketFeesCollector.address,
      })
    })

    it('reverts when setting FeesCollector from non owner account', async function () {
      await expectRevert(
        this.marketAdapter.setFeesCollector(this.marketFeesCollector.address, {
          from: someone,
        }),
        'Ownable: caller is not the owner'
      )
    })
  })

  // Adapter fee changes
  describe('Adapter fee admin', function () {
    it('emits AdapterFeeChange on succesful set', async function () {
      const adapterFee = 10000
      const receipt = await this.marketAdapter.setAdapterFee(adapterFee, {
        from: owner,
      })

      expectEvent(receipt, 'AdapterFeeChange', {
        previousFee: '0',
        newFee: '10000',
      })
    })

    it('reverts when setting AdapterFee from non owner account', async function () {
      const adapterFee = 100
      await expectRevert(
        this.marketAdapter.setAdapterFee(adapterFee, { from: someone }),
        'Ownable: caller is not the owner'
      )
    })

    it('reverts when setting AdapterFee > ADAPTER_FEE_MAX', async function () {
      const maxAllowedFee = await this.marketAdapter.ADAPTER_FEE_MAX()
      await expectRevert(
        this.marketAdapter.setAdapterFee(maxAllowedFee + 1, { from: owner }),
        'MarketAdapter: Invalid transaction fee'
      )
    })
  })

  // Receive
  describe('Testing receive() method', function () {
    it('reverts sending ethers from not allowed address', async function () {
      const randomValue = new BN(`{1e18}`);
      await expectRevert(
        this.marketAdapter.send(randomValue, { from: someone }),
        "MarketAdapter: sender invalid"
      )
    })
  })

  // Buy method
  describe('Calling adapter buy()', function () {

    before(async function () {
      // Mint test tokens to marketplace
      const tokenArr = [
        '1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000'
      ];

      for (const tokenId of tokenArr) {
        await this.erc721RegistryMock.mint(
          this.marketplaceMock.address,
          tokenId
        )
      }

      // Get configured Fees and FeeBasis
      const [marketFee, marketFeeBasis] = await Promise.all([
        this.marketAdapter.adapterTransactionFee(),
        this.marketAdapter.ADAPTER_FEE_PRECISION(),
      ])

      // Set order Value and fees
      this.orderValue = new BN(`${1e18}`)
      this.orderFees = this.orderValue.mul(marketFee).div(marketFeeBasis)

      // Total Order + fees
      this.totalOrderValue = this.orderValue.add(this.orderFees);
    })

    describe('Payment in ethers', function () {

      it('emits ExecutedOrder with onERC721Received callback', async function () {
        const tokenId = '1000'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const tracker = await balance.tracker(someone)
        const preBalance = await tracker.get()

        const receipt = await this.marketAdapter.methods[
          'buy(address,uint256,address,bytes,uint256)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          {
            value: this.totalOrderValue, // value + fees
            from: someone,
            gasPrice: 0
          }
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: this.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
        })

        /// Post balance check
        const postBalance = await tracker.get()

        postBalance.should.be.bignumber.eq(
          preBalance.sub(this.totalOrderValue)
        )
      })

      it('emits ExecutedOrder with (Deprecated) onERC721Received callback', async function () {
        const tokenId = '2000'

        // encode buyWithDeprecatedCallback(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithDeprecatedCallback(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const tracker = await balance.tracker(someone)
        const preBalance = await tracker.get()

        const receipt = await this.marketAdapter.methods[
          'buy(address,uint256,address,bytes,uint256)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          {
            value: this.totalOrderValue,
            from: someone,
            gasPrice: 0
          }
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: this.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
        })

        /// Post balance check
        const postBalance = await tracker.get()

        postBalance.should.be.bignumber.eq(
          preBalance.sub(this.totalOrderValue)
        )
      })

      it('emits ExecutedOrder without onERC721Received callback', async function () {
        const tokenId = '3000'

        // encode buyWithoutERC721Reveived(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithoutERC721Reveived(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const tracker = await balance.tracker(someone)
        const preBalance = await tracker.get()

        const receipt = await this.marketAdapter.methods[
          'buy(address,uint256,address,bytes,uint256)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          {
            value: this.totalOrderValue,
            from: someone,
            gasPrice: 0
          }
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: this.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
        })

        /// Post balance check
        const postBalance = await tracker.get()

        postBalance.should.be.bignumber.eq(
          preBalance.sub(this.totalOrderValue)
        )
      })

      // Reverts

      it('reverts non-whitelisted marketplace', async function () {
        const tokenId = '4000'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.marketAdapter.methods['buy(address,uint256,address,bytes,uint256)'](
            this.erc721RegistryMock.address,
            tokenId,
            nonWhitelistedMarket, // not whitelisted
            encodedCallData,
            this.orderValue,
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'MarketAdapter: dest market is not whitelisted'
        )
      })

      it('reverts if marketplace failed to execute the order', async function () {
        const tokenId = '4000'

        // encode buyRevert(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyRevert(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.marketAdapter.methods['buy(address,uint256,address,bytes,uint256)'](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'MarketAdapter: marketplace failed to execute buy order'
        )
      })

      it('reverts if order OK but tokenId is not transfered', async function () {
        const tokenId = '4000'

        // encode buyNotTransfer(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyNotTransfer(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.marketAdapter.methods['buy(address,uint256,address,bytes,uint256)'](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'MarketAdapter: tokenId not transfered'
        )
      })

      it('reverts msg.value is invalid', async function () {
        const tokenId = '4000'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.marketAdapter.methods['buy(address,uint256,address,bytes,uint256)'](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            {
              value: this.orderValue, // invalid order value
              from: someone,
            }
          ),
          'MarketAdapter: invalid msg.value != (order + fees)'
        )
      })

      it('reverts if balance mistmach on refund', async function () {
        const tokenId = '4000'

        // encode buyRefund(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyRefund(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.marketAdapter.methods['buy(address,uint256,address,bytes,uint256)'](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'MarketAdapter: postcall balance mismatch'
        )
      })

      describe('Without FeesCollector', function () {

        // remove collector
        before(async function () {
          await this.marketAdapter.setFeesCollector(
            constants.ZERO_ADDRESS, { from: owner }
          );
        });

        it('check fees are retained', async function () {
          const tokenId = '4000'

          const tracker = await balance.tracker(this.marketAdapter.address)
          const preBalance = await tracker.get()

          // encode buy(_tokenId, _registry) for calling the marketplace mock
          const encodedCallData = this.marketplaceMock.contract.methods
            .buy(tokenId, this.erc721RegistryMock.address)
            .encodeABI()

          await this.marketAdapter.methods[
            'buy(address,uint256,address,bytes,uint256)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            {
              value: this.totalOrderValue,
              from: someone,
            }
          )

          const postBalance = await tracker.get()

          postBalance.should.be.bignumber.eq(
            preBalance.add(this.orderFees)
          )
        })

        it('check total fees accumulated are sent on next transaction', async function () {

          // restore fees collector
          await this.marketAdapter.setFeesCollector(
            this.marketFeesCollector.address, { from: owner }
          );

          const tokenId = '5000'
          const tracker = await balance.tracker(this.marketAdapter.address)

          // encode buy(_tokenId, _registry) for calling the marketplace mock
          const encodedCallData = this.marketplaceMock.contract.methods
            .buy(tokenId, this.erc721RegistryMock.address)
            .encodeABI()

          await this.marketAdapter.methods[
            'buy(address,uint256,address,bytes,uint256)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            {
              value: this.totalOrderValue,
              from: someone,
            }
          )

          const postBalance = await tracker.get()

          postBalance.should.be.bignumber.eq('0')
        })
      })

      describe('With wrong FeesCollector', function () {

        // change collector to a contract that not implements receive()
        before(async function () {
          const nonReceiver = await NonReceiverMock.new({ from: owner })

          await this.marketAdapter.setFeesCollector(
            nonReceiver.address, { from: owner }
          );
        });

        it('reverts if fees can\'t be send to collector', async function () {
          const tokenId = '6000'

          // encode buy(_tokenId, _registry) for calling the marketplace mock
          const encodedCallData = this.marketplaceMock.contract.methods
            .buy(tokenId, this.erc721RegistryMock.address)
            .encodeABI()

          await expectRevert(
            this.marketAdapter.methods['buy(address,uint256,address,bytes,uint256)'](
              this.erc721RegistryMock.address,
              tokenId,
              this.marketplaceMock.address,
              encodedCallData,
              this.orderValue,
              {
                value: this.totalOrderValue,
                from: someone,
              }
            ),
            'MarketAdapter: error sending fees to collector'
          )
        })

        // Change back fees collector
        after(async function () {
          await this.marketAdapter.setFeesCollector(
            this.marketFeesCollector.address, { from: owner }
          );
        });
      })
    })

    describe('Payment in ERC20', function () {

      before(async function () {
        this.kyberProxy = await KyberProxyMock.new({ from: owner })
        this.uniswapProxy = await UniswapRouterMock.new({ from: owner })
      })

      const testPositiveTokenIdBuy = async function (context, tokenId, totalTokensNeeded) {

        // Mint transaction sender ERC20 test tokens
        await context.reserveTokenMock.mint(someone, totalTokensNeeded)

        // aprove MarketAdapter transfer orderValue in reserveToken
        await context.reserveTokenMock.approve(
          context.marketAdapter.address,
          totalTokensNeeded,
          {
            from: someone
          }
        )

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = context.marketplaceMock.contract.methods
          .buy(tokenId, context.erc721RegistryMock.address)
          .encodeABI()

        const preBalance = await context.reserveTokenMock.balanceOf(someone)

        const receipt = await context.marketAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,address)'
        ](
          context.erc721RegistryMock.address,
          tokenId,
          context.marketplaceMock.address,
          encodedCallData,
          context.orderValue, // orderAmount
          context.reserveTokenMock.address, // paymentToken
          {
            from: someone,
          }
        )

        /// Post Balance Check
        const postBalance = await context.reserveTokenMock.balanceOf(someone)

        postBalance.should.be.bignumber.eq(
          preBalance.sub(totalTokensNeeded)
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: context.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: context.marketplaceMock.address,
          orderValue: context.orderValue,
          orderFees: context.orderFees,
        })
      }

      const testNegativeTokenIdBuy = async function (context, tokenId, totalTokensNeeded, revertReasonText) {

        // aprove MarketAdapter transfer orderValue in reserveToken
        await context.reserveTokenMock.approve(
          context.marketAdapter.address,
          totalTokensNeeded,
          {
            from: someone,
          }
        )

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = context.marketplaceMock.contract.methods
          .buy(tokenId, context.erc721RegistryMock.address)
          .encodeABI()

        const txPromise = context.marketAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,address)'
        ](
          context.erc721RegistryMock.address,
          tokenId,
          context.marketplaceMock.address,
          encodedCallData,
          context.orderValue, // orderAmount
          context.reserveTokenMock.address, // paymentToken
          {
            from: someone,
          }
        );

        if (revertReasonText) {
          await expectRevert(txPromise, revertReasonText)

        } else {
          await expectRevert.unspecified(txPromise)

        }
      }

      describe('Using Kyber', function () {
        before(async function () {

          this.converter = await KyberConverter.new(
            this.kyberProxy.address, { from: owner }
          )

          await this.marketAdapter.setConverter(this.converter.address, {
            from: owner,
          })

          // get Total Tokens needed for order + fees
          this.totalTokensNeeded = await this.kyberProxy.calcTokensPerEther(
            this.totalOrderValue,
          );

          // Send fake proxy some ethers
          await this.kyberProxy.send(this.totalOrderValue)
        })

        it('emits ExecutedOrder with onERC721Received callback', async function () {
          await testPositiveTokenIdBuy(this, '7000', this.totalTokensNeeded)
        })

        it('reverts (safeTransferFrom) if token balance < tokens needed',  async function () {

          const tokensMinted = this.orderValue.div(new BN(100))

          // Mint transaction sender ERC20 test tokens
          await this.reserveTokenMock.mint(someone, tokensMinted)

          await testNegativeTokenIdBuy(
            this,
            '8000',
            this.totalTokensNeeded,
            undefined
          )

          // burn test tokens
          await this.reserveTokenMock.transfer(
            constants.ZERO_ADDRESS,
            tokensMinted,
            {
              from: someone
            }
          )
        })

      })

      describe('Using Uniswap', function () {
        before(async function () {

          this.converter = await UniswapV2Converter.new(
            this.uniswapProxy.address, { from: owner }
          )

          // set converter
          await this.marketAdapter.setConverter(this.converter.address, {
            from: owner,
          })

          // get Total Tokens needed for order + fees
          this.totalTokensNeeded = await this.uniswapProxy.calcTokensPerEther(
            this.totalOrderValue,
          );

          // Send fake proxy some ethers
          await this.uniswapProxy.send(this.totalOrderValue)
        })

        it('emits ExecutedOrder with onERC721Received callback', async function () {
          await testPositiveTokenIdBuy(this, '8000', this.totalTokensNeeded)
        })

        it('reverts (safeTransferFrom) if token balance < tokens needed',  async function () {

          const tokensMinted = this.orderValue.div(new BN(100))

          // Mint transaction sender ERC20 test tokens
          await this.reserveTokenMock.mint(someone, tokensMinted)

          await testNegativeTokenIdBuy(
            this,
            '9000',
            this.totalTokensNeeded,
            undefined
          )

          // burn test tokens
          await this.reserveTokenMock.transfer(
            constants.ZERO_ADDRESS,
            tokensMinted,
            {
              from: someone
            }
          )
        })
      })
    })
  })
})
