// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";


contract ConverterManager is Ownable {

    event SetConverter(address indexed converter);

    // configured fee converter
    address public converterAddress;

    /**
     * @param _converter address of collected fees burner implementation
     */
    function setConverter(address _converter) public virtual onlyOwner {
        converterAddress = _converter;
        emit SetConverter(_converter);
    }
}
