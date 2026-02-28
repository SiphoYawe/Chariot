// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CCTPBridge} from "../../src/bridge/CCTPBridge.sol";
import {ICCTPBridge} from "../../src/interfaces/ICCTPBridge.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockTokenMessengerV2} from "../mocks/MockTokenMessengerV2.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract CCTPBridgeTest is Test {
    CCTPBridge public bridge;
    MockERC20 public usdc;
    MockTokenMessengerV2 public messenger;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant USDC_UNIT = 1e6;
    uint32 constant DOMAIN_ETHEREUM = 0;
    uint32 constant DOMAIN_ARBITRUM = 3;
    uint32 constant DOMAIN_BASE = 6;
    uint32 constant DOMAIN_INVALID = 99;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        messenger = new MockTokenMessengerV2(address(usdc));
        bridge = new CCTPBridge(address(messenger), address(usdc), admin);

        // Give alice some USDC
        usdc.mint(alice, 100_000 * USDC_UNIT);
        vm.prank(alice);
        usdc.approve(address(bridge), type(uint256).max);
    }

    // ================================================================
    // Constructor Tests
    // ================================================================

    function test_constructor_setsImmutables() public view {
        assertEq(address(bridge.tokenMessenger()), address(messenger));
        assertEq(address(bridge.usdc()), address(usdc));
    }

    function test_constructor_registersDefaultChains() public view {
        assertTrue(bridge.isChainSupported(DOMAIN_ETHEREUM));
        assertTrue(bridge.isChainSupported(DOMAIN_ARBITRUM));
        assertTrue(bridge.isChainSupported(DOMAIN_BASE));
    }

    function test_constructor_grantsAdminRole() public view {
        assertTrue(bridge.hasRole(bridge.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_constructor_revertsZeroAddress() public {
        vm.expectRevert(CCTPBridge.ZeroAddress.selector);
        new CCTPBridge(address(0), address(usdc), admin);

        vm.expectRevert(CCTPBridge.ZeroAddress.selector);
        new CCTPBridge(address(messenger), address(0), admin);

        vm.expectRevert(CCTPBridge.ZeroAddress.selector);
        new CCTPBridge(address(messenger), address(usdc), address(0));
    }

    // ================================================================
    // bridgeUSDC Tests
    // ================================================================

    function test_bridgeUSDC_succeedsToEthereum() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 5000 * USDC_UNIT;

        vm.prank(alice);
        uint64 nonce = bridge.bridgeUSDC(amount, DOMAIN_ETHEREUM, recipient);

        assertEq(nonce, 0);
        assertEq(messenger.lastAmount(), amount);
        assertEq(messenger.lastDestinationDomain(), DOMAIN_ETHEREUM);
        assertEq(messenger.lastMintRecipient(), recipient);
        assertEq(messenger.callCount(), 1);
        // USDC transferred from alice through bridge to messenger (simulating burn)
        assertEq(usdc.balanceOf(alice), 95_000 * USDC_UNIT);
    }

    function test_bridgeUSDC_succeedsToArbitrum() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 1000 * USDC_UNIT;

        vm.prank(alice);
        uint64 nonce = bridge.bridgeUSDC(amount, DOMAIN_ARBITRUM, recipient);

        assertEq(nonce, 0);
        assertEq(messenger.lastDestinationDomain(), DOMAIN_ARBITRUM);
    }

    function test_bridgeUSDC_succeedsToBase() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 2500 * USDC_UNIT;

        vm.prank(alice);
        uint64 nonce = bridge.bridgeUSDC(amount, DOMAIN_BASE, recipient);

        assertEq(nonce, 0);
        assertEq(messenger.lastDestinationDomain(), DOMAIN_BASE);
    }

    function test_bridgeUSDC_emitsUSDCBridgedEvent() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 5000 * USDC_UNIT;

        vm.expectEmit(true, true, false, true);
        emit ICCTPBridge.USDCBridged(alice, DOMAIN_ETHEREUM, recipient, amount, 0);

        vm.prank(alice);
        bridge.bridgeUSDC(amount, DOMAIN_ETHEREUM, recipient);
    }

    function test_bridgeUSDC_incrementsNonce() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.startPrank(alice);
        uint64 nonce1 = bridge.bridgeUSDC(1000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient);
        uint64 nonce2 = bridge.bridgeUSDC(1000 * USDC_UNIT, DOMAIN_ARBITRUM, recipient);
        vm.stopPrank();

        assertEq(nonce1, 0);
        assertEq(nonce2, 1);
    }

    function test_bridgeUSDC_revertsUnsupportedDomain() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        vm.expectRevert(ICCTPBridge.UnsupportedDestination.selector);
        bridge.bridgeUSDC(1000 * USDC_UNIT, DOMAIN_INVALID, recipient);
    }

    function test_bridgeUSDC_revertsZeroAmount() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        vm.expectRevert(CCTPBridge.ZeroAmount.selector);
        bridge.bridgeUSDC(0, DOMAIN_ETHEREUM, recipient);
    }

    function test_bridgeUSDC_revertsInsufficientBalance() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(bob); // bob has no USDC
        vm.expectRevert(); // SafeERC20 transferFrom revert
        bridge.bridgeUSDC(1000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient);
    }

    function test_bridgeUSDC_revertsZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(CCTPBridge.ZeroRecipient.selector);
        bridge.bridgeUSDC(1000 * USDC_UNIT, DOMAIN_ETHEREUM, bytes32(0));
    }

    function test_bridgeUSDC_revertsDisabledChain() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        // Admin disables Ethereum
        vm.prank(admin);
        bridge.setChainActive(DOMAIN_ETHEREUM, false);

        vm.prank(alice);
        vm.expectRevert(ICCTPBridge.ChainNotActive.selector);
        bridge.bridgeUSDC(1000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient);
    }

    // ================================================================
    // getSupportedChains Tests
    // ================================================================

    function test_getSupportedChains_returnsAllThree() public view {
        ICCTPBridge.ChainInfo[] memory chains = bridge.getSupportedChains();

        assertEq(chains.length, 3);

        // Ethereum
        assertEq(chains[0].domain, DOMAIN_ETHEREUM);
        assertEq(chains[0].name, "Ethereum");
        assertTrue(chains[0].active);

        // Arbitrum
        assertEq(chains[1].domain, DOMAIN_ARBITRUM);
        assertEq(chains[1].name, "Arbitrum");
        assertTrue(chains[1].active);

        // Base
        assertEq(chains[2].domain, DOMAIN_BASE);
        assertEq(chains[2].name, "Base");
        assertTrue(chains[2].active);
    }

    // ================================================================
    // Admin Tests
    // ================================================================

    function test_setChainActive_disablesChain() public {
        vm.prank(admin);
        bridge.setChainActive(DOMAIN_ETHEREUM, false);

        assertFalse(bridge.isChainSupported(DOMAIN_ETHEREUM));
    }

    function test_setChainActive_reenablesChain() public {
        vm.startPrank(admin);
        bridge.setChainActive(DOMAIN_ETHEREUM, false);
        bridge.setChainActive(DOMAIN_ETHEREUM, true);
        vm.stopPrank();

        assertTrue(bridge.isChainSupported(DOMAIN_ETHEREUM));
    }

    function test_setChainActive_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ICCTPBridge.ChainStatusUpdated(DOMAIN_ETHEREUM, false);

        vm.prank(admin);
        bridge.setChainActive(DOMAIN_ETHEREUM, false);
    }

    function test_setChainActive_revertsUnauthorized() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, bridge.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(alice);
        bridge.setChainActive(DOMAIN_ETHEREUM, false);
    }

    function test_setChainActive_revertsUnsupportedDomain() public {
        vm.prank(admin);
        vm.expectRevert(ICCTPBridge.UnsupportedDestination.selector);
        bridge.setChainActive(DOMAIN_INVALID, true);
    }

    function test_registerChain_addsNewChain() public {
        uint32 newDomain = 7; // Polygon
        vm.prank(admin);
        bridge.registerChain(newDomain, "Polygon", 900);

        assertTrue(bridge.isChainSupported(newDomain));

        ICCTPBridge.ChainInfo[] memory chains = bridge.getSupportedChains();
        assertEq(chains.length, 4);
        assertEq(chains[3].domain, newDomain);
        assertEq(chains[3].name, "Polygon");
    }

    function test_registerChain_revertsDuplicate() public {
        vm.prank(admin);
        vm.expectRevert(CCTPBridge.DomainAlreadyRegistered.selector);
        bridge.registerChain(DOMAIN_ETHEREUM, "Ethereum", 1140);
    }

    // ================================================================
    // Fuzz Tests
    // ================================================================

    function testFuzz_bridgeUSDC_arbitraryAmounts(uint256 amount) public {
        // Bound to reasonable range (1 USDC to 100k USDC)
        amount = bound(amount, 1, 100_000 * USDC_UNIT);
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        uint64 nonce = bridge.bridgeUSDC(amount, DOMAIN_ETHEREUM, recipient);

        assertEq(messenger.lastAmount(), amount);
        assertEq(nonce, 0);
    }

    function testFuzz_bridgeUSDC_validDomains(uint32 domainSeed) public {
        // Pick from valid domains only
        uint32[] memory validDomains = new uint32[](3);
        validDomains[0] = DOMAIN_ETHEREUM;
        validDomains[1] = DOMAIN_ARBITRUM;
        validDomains[2] = DOMAIN_BASE;

        uint32 domain = validDomains[domainSeed % 3];
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        bridge.bridgeUSDC(1000 * USDC_UNIT, domain, recipient);

        assertEq(messenger.lastDestinationDomain(), domain);
    }
}
