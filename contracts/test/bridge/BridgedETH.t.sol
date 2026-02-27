// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {BridgedETH} from "../../src/bridge/BridgedETH.sol";
import {IBridgedETH} from "../../src/interfaces/IBridgedETH.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract BridgedETHTest is Test {
    BridgedETH public token;

    address public admin = makeAddr("admin");
    address public relayer = makeAddr("relayer");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant ONE_ETH = 1 ether;

    function setUp() public {
        token = new BridgedETH(admin, relayer);
    }

    // ================================================================
    // Constructor Tests
    // ================================================================

    function test_constructor_setsNameAndSymbol() public view {
        assertEq(token.name(), "Bridged ETH");
        assertEq(token.symbol(), "bETH");
    }

    function test_constructor_setsDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_constructor_grantsRoles() public view {
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.MINTER_ROLE(), relayer));
    }

    // ================================================================
    // Mint Tests
    // ================================================================

    function test_mint_succeedsFromRelayer() public {
        vm.prank(relayer);
        vm.expectEmit(true, false, false, true);
        emit IBridgedETH.Minted(alice, ONE_ETH, 0);
        token.mint(alice, ONE_ETH, 0);

        assertEq(token.balanceOf(alice), ONE_ETH);
        assertEq(token.totalSupply(), ONE_ETH);
    }

    function test_mint_revertsFromUnauthorized() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, token.MINTER_ROLE())
        );
        vm.prank(alice);
        token.mint(alice, ONE_ETH, 0);
    }

    function test_mint_revertsDoubleMintSameNonce() public {
        vm.startPrank(relayer);
        token.mint(alice, ONE_ETH, 0);

        vm.expectRevert(IBridgedETH.NonceAlreadyProcessed.selector);
        token.mint(alice, ONE_ETH, 0);
        vm.stopPrank();
    }

    function test_mint_revertsZeroAmount() public {
        vm.prank(relayer);
        vm.expectRevert(IBridgedETH.ZeroAmount.selector);
        token.mint(alice, 0, 0);
    }

    function test_mint_differentNoncesSucceed() public {
        vm.startPrank(relayer);
        token.mint(alice, ONE_ETH, 0);
        token.mint(bob, 2 ether, 1);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), ONE_ETH);
        assertEq(token.balanceOf(bob), 2 ether);
        assertEq(token.totalSupply(), 3 ether);
    }

    // ================================================================
    // Burn Tests
    // ================================================================

    function test_burn_succeedsAndEmitsEvent() public {
        vm.prank(relayer);
        token.mint(alice, ONE_ETH, 0);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IBridgedETH.Burned(alice, ONE_ETH);
        token.burn(ONE_ETH);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), 0);
    }

    function test_burn_revertsInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(); // ERC20InsufficientBalance
        token.burn(ONE_ETH);
    }

    function test_burn_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(IBridgedETH.ZeroAmount.selector);
        token.burn(0);
    }

    function test_burn_partialBurn() public {
        vm.prank(relayer);
        token.mint(alice, 5 ether, 0);

        vm.prank(alice);
        token.burn(2 ether);

        assertEq(token.balanceOf(alice), 3 ether);
        assertEq(token.totalSupply(), 3 ether);
    }

    // ================================================================
    // Nonce Tracking Tests
    // ================================================================

    function test_isNonceProcessed_falseByDefault() public view {
        assertFalse(token.isNonceProcessed(0));
        assertFalse(token.isNonceProcessed(999));
    }

    function test_isNonceProcessed_trueAfterMint() public {
        vm.prank(relayer);
        token.mint(alice, ONE_ETH, 42);

        assertTrue(token.isNonceProcessed(42));
        assertFalse(token.isNonceProcessed(43));
    }
}
