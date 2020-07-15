const { accounts, contract } = require('@openzeppelin/test-environment')

const {
  BN, // Big Number support
  balance, // Balance utils
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers')
const { expect } = require('chai')

const BuyAdapter = contract.fromArtifact('BuyAdapter')
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

describe('BuyAdapter', function () {
  const [owner, someone, anotherSomeone, unsafeBeneficiary] = accounts

  before(async function () {
    this.timeout(Infinity)
    // create a test ERC20 for the payments
    this.reserveTokenMock = await ERC20MockBase.new({ from: owner })

    // create a mock marketplace and assing a mock token
    this.marketplaceMock = await MarketplaceMock.new({ from: owner })

    // create a mock registry and mint tokenId to marketplace
    this.erc721RegistryMock = await ERC721Mock.new({ from: owner })

    // Create a marketplace adapter
    this.marketAdapterFees = 0
    this.buyAdapter = await BuyAdapter.new(
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

  // Fees collector
  describe('FeesCollector admin', function () {
    it('emits FeesCollectorChange on succesful set', async function () {
      const receipt = await this.buyAdapter.setFeesCollector(
        this.marketFeesCollector.address,
        { from: owner }
      )

      expectEvent(receipt, 'FeesCollectorChange', {
        collector: this.marketFeesCollector.address,
      })
    })

    it('reverts when setting FeesCollector from non owner account', async function () {
      await expectRevert(
        this.buyAdapter.setFeesCollector(this.marketFeesCollector.address, {
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
      const receipt = await this.buyAdapter.setAdapterFee(adapterFee, {
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
        this.buyAdapter.setAdapterFee(adapterFee, { from: someone }),
        'Ownable: caller is not the owner'
      )
    })

    it('reverts when setting AdapterFee > ADAPTER_FEE_MAX', async function () {
      const maxAllowedFee = await this.buyAdapter.ADAPTER_FEE_MAX()
      await expectRevert(
        this.buyAdapter.setAdapterFee(maxAllowedFee + 1, { from: owner }),
        'BuyAdapter: Invalid transaction fee'
      )
    })
  })

  // Receive
  describe('Testing receive() method', function () {
    it('reverts sending ethers from not allowed address', async function () {
      const randomValue = new BN(`{1e18}`)
      await expectRevert(
        this.buyAdapter.send(randomValue, { from: someone }),
        'BuyAdapter: sender invalid'
      )
    })
  })

  // Buy method
  describe('Calling adapter buy()', function () {
    before(async function () {
      // Mint test tokens to marketplace
      const tokenArr = [
        '100',
        '200',
        '300',
        '400',
        '1000',
        '2000',
        '3000',
        '4000',
        '5000',
        '6000',
        '7000',
        '8000',
        '9000',
        '10000',
        '20000',
      ]

      for (const tokenId of tokenArr) {
        await this.erc721RegistryMock.mint(
          this.marketplaceMock.address,
          tokenId
        )
      }

      // Get configured Fees and FeeBasis
      const [marketFee, marketFeeBasis] = await Promise.all([
        this.buyAdapter.adapterTransactionFee(),
        this.buyAdapter.ADAPTER_FEE_PRECISION(),
      ])

      // Set order Value and fees
      this.orderValue = new BN(`${1e18}`)
      this.orderFees = this.orderValue.mul(marketFee).div(marketFeeBasis)

      // Total Order + fees
      this.totalOrderValue = this.orderValue.add(this.orderFees)
    })

    describe('Payment in ethers', function () {
      it('emits ExecutedOrder with onERC721Received callback', async function () {
        const tokenId = '1000'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const userTracker = await balance.tracker(someone)
        const ownerTracker = await balance.tracker(this.marketplaceMock.address)
        const adapterTracker = await balance.tracker(this.buyAdapter.address)
        const collectorTracker = await balance.tracker(
          this.marketFeesCollector.address
        )

        const userPreBalance = await userTracker.get()
        const ownerPreBalance = await ownerTracker.get()
        const adapterPreBalance = await adapterTracker.get()
        const collectorPreBalance = await collectorTracker.get()

        const receipt = await this.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,uint8,address)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          0, // safeTransferFrom
          someone, // beneficiary
          {
            value: this.totalOrderValue, // value + fees
            from: someone,
            gasPrice: 0,
          }
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: this.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
        })

        /// Post balance checks
        const userPostBalance = await userTracker.get()
        const ownerPostBalance = await ownerTracker.get()
        const adapterPostBalance = await adapterTracker.get()
        const collectorPostBalance = await collectorTracker.get()

        // Check on user balance
        userPostBalance.should.be.bignumber.eq(
          userPreBalance.sub(this.totalOrderValue)
        )

        // Check owner has received the correct order amount
        ownerPostBalance.should.be.bignumber.eq(
          ownerPreBalance.add(this.orderValue)
        )

        // Check adapter balance = previous to order
        adapterPostBalance.should.be.bignumber.eq(adapterPreBalance)

        // Check on fees collector balance
        collectorPostBalance.should.be.bignumber.eq(
          collectorPreBalance.add(this.orderFees)
        )

        /// check beneficiary is owner of the NFT
        const itemOwner = await this.erc721RegistryMock.ownerOf(tokenId)
        itemOwner.should.be.eq(someone)
      })

      it('emits ExecutedOrder with (Deprecated) onERC721Received callback', async function () {
        const tokenId = '2000'

        // encode buyWithDeprecatedCallback(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithDeprecatedCallback(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const tracker = await balance.tracker(someone)
        const preBalance = await tracker.get()

        const receipt = await this.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,uint8,address)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          0, // safeTransferFrom
          someone, // beneficiary
          {
            value: this.totalOrderValue,
            from: someone,
            gasPrice: 0,
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

        postBalance.should.be.bignumber.eq(preBalance.sub(this.totalOrderValue))
      })

      it('emits ExecutedOrder without onERC721Received callback', async function () {
        const tokenId = '3000'

        // encode buyWithoutERC721Reveived(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithoutERC721Reveived(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const tracker = await balance.tracker(someone)
        const preBalance = await tracker.get()

        const receipt = await this.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,uint8,address)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          0, // safeTransferFrom
          someone, // beneficiary
          {
            value: this.totalOrderValue,
            from: someone,
            gasPrice: 0,
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

        postBalance.should.be.bignumber.eq(preBalance.sub(this.totalOrderValue))
      })

      it('unsafeBuy', async function () {
        const tokenId = '5000'

        // encode buyWithoutERC721Reveived(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithoutERC721Reveived(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const tracker = await balance.tracker(someone)
        const preBalance = await tracker.get()

        const receipt = await this.buyAdapter.methods[
          'buy(address,bytes,uint256)'
        ](this.marketplaceMock.address, encodedCallData, this.orderValue, {
          value: this.totalOrderValue,
          from: someone,
          gasPrice: 0,
        })

        expectEvent(receipt, 'ExecutedOrder', {
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
          marketplaceData: encodedCallData,
        })

        /// Post balance check
        const postBalance = await tracker.get()

        postBalance.should.be.bignumber.eq(preBalance.sub(this.totalOrderValue))
      })

      // Reverts
      it('reverts if marketplace failed to execute the order', async function () {
        const tokenId = '4000'

        // encode buyRevert(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyRevert(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.buyAdapter.methods[
            'buy(address,uint256,address,bytes,uint256,uint8,address)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            0, // safeTransferFrom
            someone, // beneficiary
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'BuyAdapter: marketplace failed to execute buy order'
        )
      })

      it('reverts if order OK but tokenId is not transfered', async function () {
        const tokenId = '4000'

        // encode buyNotTransfer(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyNotTransfer(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.buyAdapter.methods[
            'buy(address,uint256,address,bytes,uint256,uint8,address)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            0, // safeTransferFrom
            someone, // beneficiary
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'BuyAdapter: tokenId not transfered'
        )
      })

      it('reverts msg.value is invalid', async function () {
        const tokenId = '4000'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.buyAdapter.methods[
            'buy(address,uint256,address,bytes,uint256,uint8,address)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            0, // safeTransferFrom
            someone, // beneficiary
            {
              value: this.orderValue, // invalid order value
              from: someone,
            }
          ),
          'BuyAdapter: invalid msg.value != (order + fees)'
        )
      })

      it('reverts if balance mistmach on refund', async function () {
        const tokenId = '4000'

        // encode buyRefund(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyRefund(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.buyAdapter.methods[
            'buy(address,uint256,address,bytes,uint256,uint8,address)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            0, // safeTransferFrom
            someone, // beneficiary
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'BuyAdapter: postcall balance mismatch'
        )
      })

      describe('Without FeesCollector', function () {
        // remove collector
        before(async function () {
          await this.buyAdapter.setFeesCollector(constants.ZERO_ADDRESS, {
            from: owner,
          })
        })

        it('reverts if collector was not set', async function () {
          const tokenId = '4000'

          // encode buy(_tokenId, _registry) for calling the marketplace mock
          const encodedCallData = this.marketplaceMock.contract.methods
            .buy(tokenId, this.erc721RegistryMock.address)
            .encodeABI()

          await expectRevert(
            this.buyAdapter.methods[
              'buy(address,uint256,address,bytes,uint256,uint8,address)'
            ](
              this.erc721RegistryMock.address,
              tokenId,
              this.marketplaceMock.address,
              encodedCallData,
              this.orderValue,
              0, // safeTransferFrom
              someone, // beneficiary
              {
                value: this.totalOrderValue,
                from: someone,
              }
            ),
            'BuyAdapter: fees Collector must be set'
          )
        })
      })

      describe('With wrong FeesCollector', function () {
        // change collector to a contract that not implements receive()
        before(async function () {
          const nonReceiver = await NonReceiverMock.new({ from: owner })

          await this.buyAdapter.setFeesCollector(nonReceiver.address, {
            from: owner,
          })
        })

        it("reverts if fees can't be send to collector", async function () {
          const tokenId = '6000'

          // encode buy(_tokenId, _registry) for calling the marketplace mock
          const encodedCallData = this.marketplaceMock.contract.methods
            .buy(tokenId, this.erc721RegistryMock.address)
            .encodeABI()

          await expectRevert(
            this.buyAdapter.methods[
              'buy(address,uint256,address,bytes,uint256,uint8,address)'
            ](
              this.erc721RegistryMock.address,
              tokenId,
              this.marketplaceMock.address,
              encodedCallData,
              this.orderValue,
              0, // safeTransferFrom
              someone, // beneficiary
              {
                value: this.totalOrderValue,
                from: someone,
              }
            ),
            'BuyAdapter: error sending fees to collector'
          )
        })

        // Change back fees collector
        after(async function () {
          await this.buyAdapter.setFeesCollector(
            this.marketFeesCollector.address,
            { from: owner }
          )
        })
      })
    })

    describe('Payment in ERC20', function () {
      before(async function () {
        this.kyberProxy = await KyberProxyMock.new({ from: owner })
        this.uniswapProxy = await UniswapRouterMock.new({ from: owner })
      })

      const testPositiveTokenIdBuy = async function (
        context,
        tokenId,
        totalTokensNeeded,
        maxAllowedTokens
      ) {
        // Mint transaction sender ERC20 test tokens
        await context.reserveTokenMock.mint(someone, maxAllowedTokens)

        // aprove BuyAdapter transfer orderValue in reserveToken
        await context.reserveTokenMock.approve(
          context.buyAdapter.address,
          maxAllowedTokens,
          {
            from: someone,
          }
        )

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = context.marketplaceMock.contract.methods
          .buy(tokenId, context.erc721RegistryMock.address)
          .encodeABI()

        // Balance trackers
        const ownerTracker = await balance.tracker(
          context.marketplaceMock.address
        )
        const adapterTracker = await balance.tracker(context.buyAdapter.address)
        const collectorTracker = await balance.tracker(
          context.marketFeesCollector.address
        )

        const userPreBalance = await context.reserveTokenMock.balanceOf(someone)
        const ownerPreBalance = await ownerTracker.get()
        const adapterPreBalance = await adapterTracker.get()
        const collectorPreBalance = await collectorTracker.get()

        let ownerOfTokenBought = await context.erc721RegistryMock.ownerOf(
          tokenId
        )
        expect(ownerOfTokenBought).to.be.equal(context.marketplaceMock.address)

        const receipt = await context.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,address,uint256,uint8,address)'
        ](
          context.erc721RegistryMock.address,
          tokenId,
          context.marketplaceMock.address,
          encodedCallData,
          context.orderValue, // orderAmount
          context.reserveTokenMock.address, // paymentToken
          maxAllowedTokens,
          0, // safeTransferFrom
          someone, // beneficiary
          {
            from: someone,
          }
        )

        /// Post balance checks
        const userPostBalance = await context.reserveTokenMock.balanceOf(
          someone
        )
        const ownerPostBalance = await ownerTracker.get()
        const adapterPostBalance = await adapterTracker.get()
        const collectorPostBalance = await collectorTracker.get()

        // Check on user balance
        userPostBalance.should.be.bignumber.eq(
          userPreBalance.sub(totalTokensNeeded)
        )

        // Check owner has received the correct order amount
        ownerPostBalance.should.be.bignumber.eq(
          ownerPreBalance.add(context.orderValue)
        )

        // Check adapter balance = previous to order
        adapterPostBalance.should.be.bignumber.eq(adapterPreBalance)

        // Check on fees collector balance
        collectorPostBalance.should.be.bignumber.eq(
          collectorPreBalance.add(context.orderFees)
        )

        ownerOfTokenBought = await context.erc721RegistryMock.ownerOf(tokenId)
        expect(ownerOfTokenBought).to.be.equal(someone)

        expectEvent(receipt, 'ExecutedOrder', {
          registry: context.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: context.marketplaceMock.address,
          orderValue: context.orderValue,
          orderFees: context.orderFees,
        })
      }

      const testPositiveTokenIdUnsafeBuy = async function (
        context,
        tokenId,
        totalTokensNeeded,
        maxAllowedTokens
      ) {
        // Mint transaction sender ERC20 test tokens
        await context.reserveTokenMock.mint(someone, maxAllowedTokens)

        // aprove BuyAdapter transfer orderValue in reserveToken
        await context.reserveTokenMock.approve(
          context.buyAdapter.address,
          maxAllowedTokens,
          {
            from: someone,
          }
        )

        // encode buy(_tokenId, _registry, _beneficiary) for calling the marketplace mock
        const encodedCallData = context.marketplaceMock.contract.methods
          .buyWithBeneficiary(
            tokenId,
            context.erc721RegistryMock.address,
            anotherSomeone
          )
          .encodeABI()

        // Balance trackers
        const ownerTracker = await balance.tracker(
          context.marketplaceMock.address
        )
        const adapterTracker = await balance.tracker(context.buyAdapter.address)
        const collectorTracker = await balance.tracker(
          context.marketFeesCollector.address
        )

        const userPreBalance = await context.reserveTokenMock.balanceOf(someone)
        const ownerPreBalance = await ownerTracker.get()
        const adapterPreBalance = await adapterTracker.get()
        const collectorPreBalance = await collectorTracker.get()

        let ownerOfTokenBought = await context.erc721RegistryMock.ownerOf(
          tokenId
        )
        expect(ownerOfTokenBought).to.be.equal(context.marketplaceMock.address)

        const receipt = await context.buyAdapter.methods[
          'buy(address,bytes,uint256,address,uint256)'
        ](
          context.marketplaceMock.address,
          encodedCallData,
          context.orderValue, // orderAmount
          context.reserveTokenMock.address, // paymentToken
          maxAllowedTokens,
          {
            from: someone,
          }
        )

        /// Post balance checks
        const userPostBalance = await context.reserveTokenMock.balanceOf(
          someone
        )
        const ownerPostBalance = await ownerTracker.get()
        const adapterPostBalance = await adapterTracker.get()
        const collectorPostBalance = await collectorTracker.get()

        // Check on user balance
        userPostBalance.should.be.bignumber.eq(
          userPreBalance.sub(totalTokensNeeded)
        )

        // Check owner has received the correct order amount
        ownerPostBalance.should.be.bignumber.eq(
          ownerPreBalance.add(context.orderValue)
        )

        // Check adapter balance = previous to order
        adapterPostBalance.should.be.bignumber.eq(adapterPreBalance)

        // Check on fees collector balance
        collectorPostBalance.should.be.bignumber.eq(
          collectorPreBalance.add(context.orderFees)
        )

        ownerOfTokenBought = await context.erc721RegistryMock.ownerOf(tokenId)
        expect(ownerOfTokenBought).to.be.equal(anotherSomeone)

        expectEvent(receipt, 'ExecutedOrder', {
          marketplace: context.marketplaceMock.address,
          orderValue: context.orderValue,
          orderFees: context.orderFees,
          marketplaceData: encodedCallData,
        })
      }

      const testNegativeTokenIdBuy = async function (
        context,
        tokenId,
        maxAllowedTokens,
        revertReasonText
      ) {
        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = context.marketplaceMock.contract.methods
          .buy(tokenId, context.erc721RegistryMock.address)
          .encodeABI()

        const txPromise = context.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,address,uint256,uint8,address)'
        ](
          context.erc721RegistryMock.address,
          tokenId,
          context.marketplaceMock.address,
          encodedCallData,
          context.orderValue, // orderAmount
          context.reserveTokenMock.address, // paymentToken
          maxAllowedTokens,
          0, // safeTransferFrom
          someone, // beneficiary
          {
            from: someone,
          }
        )

        if (revertReasonText) {
          await expectRevert(txPromise, revertReasonText)
        } else {
          await expectRevert.unspecified(txPromise)
        }
      }

      describe('Using Kyber', function () {
        beforeEach(async function () {
          this.converter = await KyberConverter.new(this.kyberProxy.address, {
            from: owner,
          })

          await this.buyAdapter.setConverter(this.converter.address, {
            from: owner,
          })

          // get Total Tokens needed for order + fees
          this.totalTokensNeeded = await this.kyberProxy.calcTokensPerEther(
            this.totalOrderValue
          )

          // Add a 5% to the tokens needed order as maxTokens allowed to spend
          this.maxTokensAllowed = this.totalTokensNeeded.add(
            this.totalTokensNeeded.mul(new BN(5)).div(new BN(100))
          )

          // Send fake proxy some ethers
          await this.kyberProxy.send(this.totalOrderValue)
        })

        it('emits ExecutedOrder with onERC721Received callback (exact tokens amount):: buy', async function () {
          await testPositiveTokenIdBuy(
            this,
            '7000',
            this.totalTokensNeeded,
            this.maxTokensAllowed
          )
        })

        it('emits ExecutedOrder with onERC721Received callback (exact tokens amount):: UnsafeBuy', async function () {
          await testPositiveTokenIdUnsafeBuy(
            this,
            '10000',
            this.totalTokensNeeded,
            this.maxTokensAllowed
          )
        })

        it('reverts if adapter not approved token transfers', async function () {
          // Mint transaction sender ERC20 test tokens
          await this.reserveTokenMock.mint(someone, this.maxTokensAllowed)

          await testNegativeTokenIdBuy(
            this,
            '8000',
            this.maxTokensAllowed,
            'ERC20: transfer amount exceeds allowance'
          )
        })

        it('reverts if maxTokensAllowed is < needed', async function () {
          // Mint transaction sender ERC20 test tokens
          await this.reserveTokenMock.mint(someone, this.maxTokensAllowed)

          // aprove BuyAdapter transfer orderValue in reserveToken
          await this.reserveTokenMock.approve(
            this.buyAdapter.address,
            this.maxTokensAllowed,
            {
              from: someone,
            }
          )

          await testNegativeTokenIdBuy(
            this,
            '8000',
            this.totalTokensNeeded, // send not enought tokens to fulfill the order
            'BuyAdapter: paymentTokenAmount > _maxPaymentTokenAmount'
          )
        })

        it('reverts (safeTransferFrom) if token balance < tokens needed', async function () {
          // burn current Balance tokens
          await this.reserveTokenMock.transfer(
            constants.ZERO_ADDRESS,
            await this.reserveTokenMock.balanceOf(someone),
            {
              from: someone,
            }
          )

          const tokensMinted = this.orderValue.div(new BN(100))

          // Mint transaction sender ERC20 test tokens
          await this.reserveTokenMock.mint(someone, tokensMinted)

          // aprove BuyAdapter transfer orderValue in reserveToken
          await this.reserveTokenMock.approve(
            this.buyAdapter.address,
            this.totalTokensNeeded,
            {
              from: someone,
            }
          )

          await testNegativeTokenIdBuy(
            this,
            '8000',
            this.maxTokensAllowed,
            'ERC20: transfer amount exceeds balance'
          )

          // burn test tokens
          await this.reserveTokenMock.transfer(
            constants.ZERO_ADDRESS,
            tokensMinted,
            {
              from: someone,
            }
          )
        })
      })

      describe('Using Uniswap', function () {
        beforeEach(async function () {
          this.converter = await UniswapV2Converter.new(
            this.uniswapProxy.address,
            { from: owner }
          )

          // set converter
          await this.buyAdapter.setConverter(this.converter.address, {
            from: owner,
          })

          // get Total Tokens needed for order + fees
          this.totalTokensNeeded = await this.uniswapProxy.calcTokensPerEther(
            this.totalOrderValue
          )

          // Add a 5% to the tokens needed order as maxTokens allowed to spend
          this.maxTokensAllowed = this.totalTokensNeeded.add(
            this.totalTokensNeeded.mul(new BN(5)).div(new BN(100))
          )

          // Send fake proxy some ethers
          await this.uniswapProxy.send(this.totalOrderValue)
        })

        it('emits ExecutedOrder with onERC721Received callback', async function () {
          await testPositiveTokenIdBuy(
            this,
            '8000',
            this.totalTokensNeeded,
            this.maxTokensAllowed
          )
        })

        it('emits ExecutedOrder with onERC721Received callback (exact tokens amount):: UnsafeBuy', async function () {
          await testPositiveTokenIdUnsafeBuy(
            this,
            '20000',
            this.totalTokensNeeded,
            this.maxTokensAllowed
          )
        })

        it('reverts (safeTransferFrom) if token balance < tokens needed', async function () {
          // burn current Balance tokens
          await this.reserveTokenMock.transfer(
            constants.ZERO_ADDRESS,
            await this.reserveTokenMock.balanceOf(someone),
            {
              from: someone,
            }
          )

          const tokensMinted = this.orderValue.div(new BN(100))

          // Mint transaction sender ERC20 test tokens
          await this.reserveTokenMock.mint(someone, tokensMinted)

          // aprove BuyAdapter transfer orderValue in reserveToken
          await this.reserveTokenMock.approve(
            this.buyAdapter.address,
            this.totalTokensNeeded,
            {
              from: someone,
            }
          )

          await testNegativeTokenIdBuy(
            this,
            '9000',
            this.maxTokensAllowed,
            'ERC20: transfer amount exceeds balance'
          )

          // burn test tokens
          await this.reserveTokenMock.transfer(
            constants.ZERO_ADDRESS,
            tokensMinted,
            {
              from: someone,
            }
          )
        })
      })
    })

    describe('Test supported alternative transfer methods', function () {
      it('order OK using transferFrom()', async function () {
        const tokenId = '100'

        // encode buyWithoutERC721Reveived(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithoutERC721Reveived(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const receipt = await this.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,uint8,address)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          1, // transferFrom
          someone, // beneficiary
          {
            value: this.totalOrderValue,
            from: someone,
            gasPrice: 0,
          }
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: this.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
        })

        /// check beneficiary is owner of the NFT
        const itemOwner = await this.erc721RegistryMock.ownerOf(tokenId)
        itemOwner.should.be.eq(someone)
      })

      it('order OK using transfer()', async function () {
        const tokenId = '200'

        // encode buyWithoutERC721Reveived(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buyWithoutERC721Reveived(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        const receipt = await this.buyAdapter.methods[
          'buy(address,uint256,address,bytes,uint256,uint8,address)'
        ](
          this.erc721RegistryMock.address,
          tokenId,
          this.marketplaceMock.address,
          encodedCallData,
          this.orderValue,
          2, // transfer
          someone, // beneficiary
          {
            value: this.totalOrderValue,
            from: someone,
            gasPrice: 0,
          }
        )

        expectEvent(receipt, 'ExecutedOrder', {
          registry: this.erc721RegistryMock.address,
          tokenId: tokenId,
          marketplace: this.marketplaceMock.address,
          orderValue: this.orderValue,
          orderFees: this.orderFees,
        })

        /// check beneficiary is owner of the NFT
        const itemOwner = await this.erc721RegistryMock.ownerOf(tokenId)
        itemOwner.should.be.eq(someone)
      })

      it('reverts using a non supported enum type (invalid opcode)', async function () {
        const tokenId = '300'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.buyAdapter.methods[
            'buy(address,uint256,address,bytes,uint256,uint8,address)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            8, // unsupported
            someone, // beneficiary
            {
              value: this.totalOrderValue,
              from: someone,
              gasPrice: 0,
            }
          ),
          'invalid opcode'
        )
      })

      it('reverts by invalid beneficiary', async function () {
        const tokenId = '300'

        // encode buy(_tokenId, _registry) for calling the marketplace mock
        const encodedCallData = this.marketplaceMock.contract.methods
          .buy(tokenId, this.erc721RegistryMock.address)
          .encodeABI()

        await expectRevert(
          this.buyAdapter.methods[
            'buy(address,uint256,address,bytes,uint256,uint8,address)'
          ](
            this.erc721RegistryMock.address,
            tokenId,
            this.marketplaceMock.address,
            encodedCallData,
            this.orderValue,
            10, // non supported
            this.buyAdapter.address, // invalid beneficiary
            {
              value: this.totalOrderValue,
              from: someone,
            }
          ),
          'BuyAdapter: invalid beneficiary'
        )
      })
    })
  })
})
