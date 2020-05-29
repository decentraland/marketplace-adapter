// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


// mock class using ERC721
contract ERC721Mock is ERC721 {
    constructor (
        address _to,
        uint256 _tokenId
    )
        public ERC721("MOCK721", "MOCK721")
    {
        _mint(_to, _tokenId);
    }

    function transfer(address _from, address _to, uint256 _tokenId) public {
        _transfer(_from, _to, _tokenId);
    }
}
