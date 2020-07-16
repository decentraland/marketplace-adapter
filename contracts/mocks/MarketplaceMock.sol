// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "./ERC721Mock.sol";


contract MarketplaceMock {

    function _checkOwnership(uint256 _tokenId, address _registry) private view {
        require(
            ERC721Mock(_registry).ownerOf(_tokenId) == address(this),
            "MarketplaceMock: not asset owner"
        );
    }

    function buyRevert(uint256, address) public payable {
        require(false, "fail order");
    }

    function buyRefund(uint256, address) public payable {
        selfdestruct(msg.sender);
    }

    function buyNotTransfer(uint256 _tokenId, address _registry) public payable {
        _checkOwnership(_tokenId, _registry);
    }

    // calls deprecated onERC721Received(address,uint256,bytes) after transfer
    function buyWithDeprecatedCallback(uint256 _tokenId, address _registry) public payable {
        _checkOwnership(_tokenId, _registry);

        address tokenRecipient = msg.sender;

        ERC721Mock(_registry).transferFrom(
            address(this), tokenRecipient, _tokenId
        );

        (bool success, bytes memory returndata) = tokenRecipient.call(
            abi.encodeWithSignature(
                "onERC721Received(address,uint256,bytes)", tokenRecipient, _tokenId, ""
            )
        );

        require(
            success,
            "MarketplaceMock: transfer to non OLD-ERC721Receiver implementer"
        );

        bytes4 retval = abi.decode(returndata, (bytes4));

        require(
            retval == 0xf0b9e5ba,
            "MarketplaceMock: wrong OLD-ERC721Receiver response"
        );
    }

    function buy(uint256 _tokenId, address _registry) public payable {
        _checkOwnership(_tokenId, _registry);

        ERC721Mock(_registry).safeTransferFrom(
            address(this), msg.sender, _tokenId
        );
    }

    function buyWithBeneficiary(uint256 _tokenId, address _registry, address _beneficiry) public payable {
        _checkOwnership(_tokenId, _registry);

        ERC721Mock(_registry).safeTransferFrom(
            address(this), _beneficiry, _tokenId
        );
    }

    // this buy method wont call ERC721Reveived callback
    function buyWithoutERC721Reveived(uint256 _tokenId, address _registry) public payable {
        _checkOwnership(_tokenId, _registry);

        ERC721Mock(_registry).transferFrom(
            address(this), msg.sender, _tokenId
        );
    }
}
