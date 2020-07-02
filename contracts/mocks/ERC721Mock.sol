// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


// mock class using ERC721
contract ERC721Mock is ERC721 {
    constructor () public ERC721("MOCK721", "MOCK721") {

    }

    function mint(address _to, uint256 _tokenId) public {
        _mint(_to, _tokenId);
    }

    function transfer(address _to, uint256 _tokenId) public {
        _transfer(msg.sender, _to, _tokenId);
    }
}
