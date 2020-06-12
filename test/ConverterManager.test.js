const { accounts, contract } = require('@openzeppelin/test-environment')

const {
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers')

const ConverterManager = contract.fromArtifact('ConverterManager')

require('chai').should()

describe('ConverterManager', function () {
  const [owner, someone, someConverterAddress ] = accounts

  before(async function () {
    // create a test ERC20 for the payments
    this.converterManager = await ConverterManager.new({ from: owner })
  })

  // Adapter fee changes
  describe('Admin', function () {

    it('emits SetConverter on succesful set', async function () {
      const receipt = await this.converterManager.setConverter(
        someConverterAddress, { from: owner }
      )

      expectEvent(receipt, 'SetConverter', {
        converter: someConverterAddress
      })
    })

    it('reverts when setting Converter from non owner account', async function () {
      await expectRevert(
        this.converterManager.setConverter(
          someConverterAddress, { from: someone }
        ),
        'Ownable: caller is not the owner'
      )
    })

  })
});
