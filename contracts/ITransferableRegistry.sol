// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface ITransferableRegistry is IERC721 {
    function transfer(address _to, uint256 _tokenId) external;
}
