// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "./ERC721Mock.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";


contract MarketplaceMock {

    function buy(uint256 _assetId, address _registry) public {
        IERC721(_registry).safeTransferFrom(
            address(this), msg.sender, _assetId
        );
    }

    /// this buy method wont call ERC721Reveived callback
    function buyAlt(uint256 _assetId, address _registry) public {
        ERC721Mock(_registry).transfer(
            address(this), msg.sender, _assetId
        );
    }
}
