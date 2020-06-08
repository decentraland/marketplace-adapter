// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


contract ERC721Holder is IERC721Receiver {

    // Equal to: bytes4(keccak256("onERC721Received(address,uint256,bytes)"));
    bytes4 internal constant OLD_ERC721_RECEIVED = 0xf0b9e5ba;

    // Equal to: bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")).
    bytes4 internal constant NEW_ERC721_RECEIVED = 0x150b7a02;

    /**
     * @dev implements old onERC721Received interface
     */
    function onERC721Received(address, address, uint256) public pure returns (bytes4) {
        return OLD_ERC721_RECEIVED;
    }

    /**
     * @dev The ERC721 smart contract calls this function on the recipient
     *  after a {IERC721-safeTransferFrom}.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    )
        public virtual override returns (bytes4)
    {
        return NEW_ERC721_RECEIVED;
    }
}
