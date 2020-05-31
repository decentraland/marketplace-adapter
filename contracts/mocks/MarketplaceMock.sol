// SPDX-License-Identifier: Apache-2.0

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

    function buy(uint256 _tokenId, address _registry) public payable {
        _checkOwnership(_tokenId, _registry);

        ERC721Mock(_registry).safeTransferFrom(
            address(this), msg.sender, _tokenId
        );
    }

    // this buy method wont call ERC721Reveived callback
    function buyAlt(uint256 _tokenId, address _registry) public payable {
        _checkOwnership(_tokenId, _registry);

        ERC721Mock(_registry).transferFrom(
            address(this), msg.sender, _tokenId
        );
    }
}
