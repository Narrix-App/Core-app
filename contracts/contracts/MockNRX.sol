// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockNRX is ERC20 {
    constructor() ERC20("Narrix", "NRX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
