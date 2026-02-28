// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {ILiquidationEngine} from "../src/interfaces/ILiquidationEngine.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {ICollateralManager} from "../src/interfaces/ICollateralManager.sol";
import {IChariotVault} from "../src/interfaces/IChariotVault.sol";
import {IInterestRateModel} from "../src/interfaces/IInterestRateModel.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {ETHEscrow} from "../src/bridge/ETHEscrow.sol";
import {IBridgedETH} from "../src/interfaces/IBridgedETH.sol";
import {IETHEscrow} from "../src/interfaces/IETHEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title EventEmissionTest -- Comprehensive event emission tests across all Chariot protocol contracts
/// @notice Validates that every state-changing operation emits the correct indexed event
contract EventEmissionTest is Test {
    // -- Contracts --
    LiquidationEngine public liquidationEngine;
    LendingPool public pool;
    CollateralManager public collateralManager;
    ChariotVault public vault;
    InterestRateModel public rateModel;
    BridgedETH public bridgedETH;
    ETHEscrow public escrow;

    // -- Mocks --
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;

    // -- Addresses --
    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public relayer = makeAddr("relayer");

    // -- Constants --
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;
    uint256 constant USDC_UNIT = 1e6;
    uint256 constant WAD = 1e18;
    int192 constant ETH_PRICE = int192(int256(2000e18));

    // -- Empty oracle updates for calls that require the parameter --
    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        // Warp to avoid timestamp underflow issues
        vm.warp(100_000);

        // Deploy tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockERC20("US Yield Coin", "USYC", 6);
        stork = new MockStork();
        teller = new MockUSYCTeller(address(usdc), address(usyc), 1e18);

        // Deploy bridge contracts
        bridgedETH = new BridgedETH(admin, relayer);
        escrow = new ETHEscrow(relayer);

        // Deploy core contracts
        rateModel = new InterestRateModel();
        vault = new ChariotVault(address(usdc), address(usyc), address(teller), address(stork), admin);
        collateralManager = new CollateralManager(address(bridgedETH), address(stork), admin);
        pool = new LendingPool(address(usdc), address(stork), admin);
        liquidationEngine = new LiquidationEngine(address(usdc), address(stork), admin);

        // Wire dependencies as admin
        vm.startPrank(admin);
        pool.setInterestRateModel(address(rateModel));
        pool.setCollateralManager(address(collateralManager));
        pool.setVault(address(vault));
        collateralManager.setLendingPool(address(pool));
        liquidationEngine.setLendingPool(address(pool));
        liquidationEngine.setCollateralManager(address(collateralManager));
        liquidationEngine.setVault(address(vault));

        // Grant roles
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));
        pool.grantRole(pool.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        collateralManager.grantRole(collateralManager.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        pool.grantRole(pool.OPERATOR_ROLE(), admin);
        collateralManager.grantRole(collateralManager.OPERATOR_ROLE(), admin);
        liquidationEngine.grantRole(liquidationEngine.OPERATOR_ROLE(), admin);
        vm.stopPrank();

        // Set ETH price to $2000
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Fund vault with 1M USDC
        usdc.mint(address(this), 1_000_000 * USDC_UNIT);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000 * USDC_UNIT, address(this));

        // Mint alice 5 ETH collateral (nonce=0) and deposit as collateral
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 0);

        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // Give alice USDC for repayments
        usdc.mint(alice, 100_000 * USDC_UNIT);

        // Give bob USDC for liquidation purposes
        usdc.mint(bob, 500_000 * USDC_UNIT);
        vm.prank(bob);
        usdc.approve(address(liquidationEngine), type(uint256).max);
    }

    // ================================================================
    // 1. CollateralManager Events
    // ================================================================

    /// @notice CollateralDeposited is emitted when a user deposits collateral
    function test_depositCollateral_emitsCollateralDeposited() public {
        // Mint fresh ETH for alice to deposit
        vm.prank(relayer);
        bridgedETH.mint(alice, 1 ether, 1);

        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), type(uint256).max);

        vm.expectEmit(true, true, true, true);
        emit ICollateralManager.CollateralDeposited(alice, address(bridgedETH), 1 ether);

        collateralManager.depositCollateral(address(bridgedETH), 1 ether);
        vm.stopPrank();
    }

    /// @notice CollateralWithdrawn is emitted when a user withdraws collateral (zero debt required)
    function test_withdrawCollateral_emitsCollateralWithdrawn() public {
        // Alice has 5 ETH deposited and zero debt -- she can withdraw
        vm.startPrank(alice);

        vm.expectEmit(true, true, true, true);
        emit ICollateralManager.CollateralWithdrawn(alice, address(bridgedETH), 1 ether);

        collateralManager.withdrawCollateral(address(bridgedETH), 1 ether);
        vm.stopPrank();
    }

    /// @notice CollateralSeized is emitted during liquidation when collateral is seized
    function test_seizeCollateral_emitsCollateralSeized() public {
        // Alice borrows max to set up liquidation scenario
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Drop ETH price to make alice liquidatable
        // HF = (5 * 1800 * 0.82) / 7500 = 7380/7500 = 0.984 < 1.0
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));

        uint256 debtToRepay = 2000 * USDC_UNIT;
        // HF = 0.984e18 -> scaled bonus = 580 BPS = 5.8e16 WAD
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(984e15);
        uint256 bonusWad = bonusBps * 1e14;
        uint256 expectedSeizure =
            liquidationEngine.calculateSeizableCollateral(uint256(2000e18), uint256(1800e18), bonusWad);

        // Expect CollateralSeized from CollateralManager during liquidation
        vm.expectEmit(true, true, true, true);
        emit ICollateralManager.CollateralSeized(alice, bob, address(bridgedETH), expectedSeizure);

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);
    }

    /// @notice LendingPoolUpdated is emitted when admin sets the lending pool reference
    function test_setLendingPool_emitsLendingPoolUpdated() public {
        address newPool = makeAddr("newPool");

        // Deploy a fresh CollateralManager for a clean test
        CollateralManager freshCM = new CollateralManager(address(bridgedETH), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit CollateralManager.LendingPoolUpdated(address(0), newPool);

        freshCM.setLendingPool(newPool);
        vm.stopPrank();
    }

    /// @notice PriceFeedIdSet is emitted when admin sets a price feed ID for a token
    function test_setPriceFeedId_emitsPriceFeedIdSet() public {
        bytes32 newFeedId = keccak256("CUSTOM_FEED");

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit CollateralManager.PriceFeedIdSet(address(bridgedETH), newFeedId);

        collateralManager.setPriceFeedId(address(bridgedETH), newFeedId);
        vm.stopPrank();
    }

    // ================================================================
    // 2. LendingPool Events
    // ================================================================

    /// @notice Borrowed is emitted when a user borrows USDC
    function test_borrow_emitsBorrowed() public {
        uint256 borrowAmount = 3000 * USDC_UNIT;

        // Health factor calculation:
        // collateralValue = 5 ETH * $2000 = $10000 = 10000e6 USDC
        // collateralWad = 10000e6 * 1e12 = 10000e18
        // debtWad = 3000e6 * 1e12 = 3000e18
        // thresholdValue = wadMul(10000e18, 0.82e18) = 8200e18
        // HF = wadDiv(8200e18, 3000e18) = 8200e18 * 1e18 / 3000e18 = 2733333333333333333
        uint256 expectedHealthFactor = 2_733_333_333_333_333_333;

        // Use (true, true, true, true) to verify all fields including computed HF
        vm.expectEmit(true, true, true, true);
        emit ILendingPool.Borrowed(alice, address(bridgedETH), borrowAmount, expectedHealthFactor);

        vm.prank(alice);
        pool.borrow(address(bridgedETH), borrowAmount, emptyUpdates);
    }

    /// @notice Repaid is emitted when a user repays partial debt
    function test_repay_emitsRepaid() public {
        // Alice borrows first
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        uint256 repayAmount = 1000 * USDC_UNIT;
        uint256 remainingDebt = 3000 * USDC_UNIT - repayAmount; // 2000e6

        vm.startPrank(alice);

        vm.expectEmit(true, true, true, true);
        emit ILendingPool.Repaid(alice, repayAmount, remainingDebt);

        pool.repay(repayAmount);
        vm.stopPrank();
    }

    /// @notice Repaid is emitted with remainingDebt=0 on full repayment
    function test_repayFull_emitsRepaid() public {
        // Alice borrows first
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        uint256 debt = pool.getUserDebt(alice);

        vm.startPrank(alice);

        vm.expectEmit(true, true, true, true);
        emit ILendingPool.Repaid(alice, debt, 0);

        pool.repayFull();
        vm.stopPrank();
    }

    /// @notice InterestAccrued is emitted when interest accrues over time
    function test_accrueInterest_emitsInterestAccrued() public {
        // Alice borrows to create outstanding debt
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        // Warp 365 days forward to accumulate meaningful interest
        vm.warp(block.timestamp + 365 days);

        // Refresh oracle timestamp so price is not stale
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Check that InterestAccrued is emitted -- exact values are hard to predict
        // so we only verify that the event is emitted (check topic0 only)
        vm.expectEmit(false, false, false, false);
        emit ILendingPool.InterestAccrued(0, 0, 0);

        pool.accrueInterest();
    }

    /// @notice InterestRateModelUpdated is emitted when admin sets the rate model
    function test_setInterestRateModel_emitsInterestRateModelUpdated() public {
        InterestRateModel newModel = new InterestRateModel();

        // Deploy fresh pool for clean event test
        LendingPool freshPool = new LendingPool(address(usdc), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit LendingPool.InterestRateModelUpdated(address(0), address(newModel));

        freshPool.setInterestRateModel(address(newModel));
        vm.stopPrank();
    }

    /// @notice CollateralManagerUpdated is emitted when admin sets the collateral manager
    function test_setCollateralManager_emitsCollateralManagerUpdated() public {
        address newManager = makeAddr("newManager");

        LendingPool freshPool = new LendingPool(address(usdc), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit LendingPool.CollateralManagerUpdated(address(0), newManager);

        freshPool.setCollateralManager(newManager);
        vm.stopPrank();
    }

    /// @notice VaultUpdated is emitted when admin sets the vault
    function test_setVault_emitsVaultUpdated() public {
        address newVault = makeAddr("newVault");

        LendingPool freshPool = new LendingPool(address(usdc), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit LendingPool.VaultUpdated(address(0), newVault);

        freshPool.setVault(newVault);
        vm.stopPrank();
    }

    // ================================================================
    // 3. LiquidationEngine Events
    // ================================================================

    /// @notice PositionLiquidated is emitted during a successful liquidation
    function test_liquidate_emitsPositionLiquidated() public {
        // Alice borrows max
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Drop price to make alice liquidatable
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));

        uint256 debtToRepay = 2000 * USDC_UNIT;
        // HF = (5*1800*0.82)/7500 = 0.984e18 -> bonusBps = 580 -> bonusWad = 5.8e16
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(984e15);
        uint256 bonusWad = bonusBps * 1e14;
        uint256 expectedSeizure =
            liquidationEngine.calculateSeizableCollateral(uint256(2000e18), uint256(1800e18), bonusWad);

        vm.expectEmit(true, true, true, true);
        emit ILiquidationEngine.PositionLiquidated(
            alice, bob, address(bridgedETH), debtToRepay, expectedSeizure, bonusWad
        );

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);
    }

    // ================================================================
    // 3b. LiquidationEngine Admin Events
    // ================================================================

    /// @notice LendingPoolUpdated is emitted when admin sets the lending pool on LiquidationEngine
    function test_liquidationEngine_setLendingPool_emitsLendingPoolUpdated() public {
        address newPool = makeAddr("newPool2");

        LiquidationEngine freshLE = new LiquidationEngine(address(usdc), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit LiquidationEngine.LendingPoolUpdated(address(0), newPool);

        freshLE.setLendingPool(newPool);
        vm.stopPrank();
    }

    /// @notice CollateralManagerUpdated is emitted when admin sets the collateral manager on LiquidationEngine
    function test_liquidationEngine_setCollateralManager_emitsCollateralManagerUpdated() public {
        address newCM = makeAddr("newCM");

        LiquidationEngine freshLE = new LiquidationEngine(address(usdc), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit LiquidationEngine.CollateralManagerUpdated(address(0), newCM);

        freshLE.setCollateralManager(newCM);
        vm.stopPrank();
    }

    /// @notice VaultUpdated is emitted when admin sets the vault on LiquidationEngine
    function test_liquidationEngine_setVault_emitsVaultUpdated() public {
        address newVault = makeAddr("newVault2");

        LiquidationEngine freshLE = new LiquidationEngine(address(usdc), address(stork), admin);

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit LiquidationEngine.VaultUpdated(address(0), newVault);

        freshLE.setVault(newVault);
        vm.stopPrank();
    }

    // ================================================================
    // 3c. CollateralManager Config Events
    // ================================================================

    /// @notice CollateralTypeAdded is emitted when admin adds a new collateral type
    function test_addCollateralType_emitsCollateralTypeAdded() public {
        address mockToken = makeAddr("mockCollateral");
        bytes32 feedId = keccak256("MOCK_FEED");

        CollateralManager.CollateralConfig memory config = CollateralManager.CollateralConfig({
            baseLTV: 0.7e18,
            liquidationThreshold: 0.8e18,
            liquidationBonus: 0.05e18,
            priceFeedId: feedId,
            volatilityFeedId: bytes32(0),
            isActive: true
        });

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit CollateralManager.CollateralTypeAdded(mockToken, 0.7e18, 0.8e18, 0.05e18);

        collateralManager.addCollateralType(mockToken, config);
        vm.stopPrank();
    }

    /// @notice CollateralConfigUpdated is emitted when admin updates an existing collateral config
    function test_updateCollateralConfig_emitsCollateralConfigUpdated() public {
        address mockToken = makeAddr("mockCollateral2");
        bytes32 feedId = keccak256("MOCK_FEED_2");

        // First add the collateral type
        CollateralManager.CollateralConfig memory config = CollateralManager.CollateralConfig({
            baseLTV: 0.7e18,
            liquidationThreshold: 0.8e18,
            liquidationBonus: 0.05e18,
            priceFeedId: feedId,
            volatilityFeedId: bytes32(0),
            isActive: true
        });

        vm.startPrank(admin);
        collateralManager.addCollateralType(mockToken, config);

        // Now update it
        CollateralManager.CollateralConfig memory newConfig = CollateralManager.CollateralConfig({
            baseLTV: 0.65e18,
            liquidationThreshold: 0.75e18,
            liquidationBonus: 0.08e18,
            priceFeedId: feedId,
            volatilityFeedId: bytes32(0),
            isActive: true
        });

        vm.expectEmit(true, true, true, true);
        emit CollateralManager.CollateralConfigUpdated(mockToken, 0.65e18, 0.75e18, 0.08e18);

        collateralManager.updateCollateralConfig(mockToken, newConfig);
        vm.stopPrank();
    }

    // ================================================================
    // 4. ChariotVault Events
    // ================================================================

    /// @notice USDCLent is emitted when the vault lends USDC to the lending pool (triggered via borrow)
    function test_lend_emitsUSDCLent() public {
        uint256 borrowAmount = 3000 * USDC_UNIT;

        // USDCLent is emitted by the vault when pool.borrow() calls vault.lend()
        vm.expectEmit(true, true, true, true);
        emit IChariotVault.USDCLent(address(pool), borrowAmount);

        vm.prank(alice);
        pool.borrow(address(bridgedETH), borrowAmount, emptyUpdates);
    }

    /// @notice USDCRepaid is emitted when USDC is returned to the vault (triggered via repay)
    function test_repay_emitsUSDCRepaid() public {
        // Alice borrows first
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        uint256 repayAmount = 1000 * USDC_UNIT;

        // USDCRepaid is emitted by the vault when pool.repay() calls vault.repay()
        vm.expectEmit(true, true, true, true);
        emit IChariotVault.USDCRepaid(address(pool), repayAmount);

        vm.prank(alice);
        pool.repay(repayAmount);
    }

    /// @notice Rebalanced is emitted when operator triggers vault rebalance
    function test_rebalance_emitsRebalanced() public {
        // The vault already has 1M USDC from setUp deposits.
        // Rebalance should move excess idle USDC into USYC (keeping 5% buffer).
        // totalAssets = 1M USDC (all idle)
        // targetBuffer = 1M * 5% = 50,000 USDC
        // excess = 1M - 50,000 = 950,000 USDC

        // Fund teller with USDC so redemption works (already has from deposit logic)
        // The teller mints USYC to vault on deposit -- mock teller handles this.
        // We need the teller to have enough USDC for potential redeems:
        usdc.mint(address(teller), 1_000_000 * USDC_UNIT);

        uint256 totalAssets = vault.totalAssets();
        uint256 targetBuffer = (totalAssets * 0.05e18) / 1e18;
        uint256 currentIdle = usdc.balanceOf(address(vault));
        uint256 excess = currentIdle - targetBuffer;

        // After rebalance, USYC balance of vault will be `excess` (at 1:1 price)
        vm.expectEmit(true, true, true, true);
        emit ChariotVault.Rebalanced(excess, 0, excess);

        vm.prank(admin);
        vault.rebalance();
    }

    // ================================================================
    // 5. BridgedETH Events
    // ================================================================

    /// @notice Minted is emitted when relayer mints BridgedETH
    function test_mint_emitsMinted() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 2 ether;
        uint256 nonce = 100;

        vm.expectEmit(true, true, true, true);
        emit IBridgedETH.Minted(recipient, amount, nonce);

        vm.prank(relayer);
        bridgedETH.mint(recipient, amount, nonce);
    }

    /// @notice Burned is emitted when a user burns BridgedETH
    function test_burn_emitsBurned() public {
        // Mint some BridgedETH to bob first
        vm.prank(relayer);
        bridgedETH.mint(bob, 1 ether, 200);

        vm.expectEmit(true, true, true, true);
        emit IBridgedETH.Burned(bob, 1 ether);

        vm.prank(bob);
        bridgedETH.burn(1 ether);
    }

    // ================================================================
    // 6. ETHEscrow Events
    // ================================================================

    /// @notice Deposited is emitted when a user sends ETH to the escrow
    function test_deposit_emitsDeposited() public {
        uint256 depositAmount = 1 ether;
        uint256 expectedNonce = escrow.getCurrentNonce(); // should be 0

        vm.deal(alice, 10 ether);

        vm.expectEmit(true, true, true, true);
        emit IETHEscrow.Deposited(alice, depositAmount, expectedNonce);

        vm.prank(alice);
        escrow.deposit{value: depositAmount}();
    }

    /// @notice Released is emitted when relayer releases ETH back to depositor
    function test_release_emitsReleased() public {
        uint256 depositAmount = 1 ether;
        vm.deal(alice, 10 ether);

        // Alice deposits first
        vm.prank(alice);
        escrow.deposit{value: depositAmount}();

        uint256 nonce = 0;

        vm.expectEmit(true, true, true, true);
        emit IETHEscrow.Released(alice, depositAmount, nonce);

        vm.prank(relayer);
        escrow.release(alice, depositAmount, nonce);
    }

    /// @notice Refunded is emitted when a user refunds after the timeout period
    function test_refund_emitsRefunded() public {
        uint256 depositAmount = 1 ether;
        vm.deal(alice, 10 ether);

        // Alice deposits
        vm.prank(alice);
        escrow.deposit{value: depositAmount}();

        uint256 nonce = 0;

        // Warp past the refund timeout (24 hours)
        vm.warp(block.timestamp + escrow.REFUND_TIMEOUT() + 1);

        vm.expectEmit(true, true, true, true);
        emit IETHEscrow.Refunded(alice, depositAmount, nonce);

        vm.prank(alice);
        escrow.refund(nonce);
    }

    // ================================================================
    // 7. ChariotBase Admin Events
    // ================================================================

    /// @notice StorkOracleUpdated is emitted when admin sets the oracle address
    function test_setStorkOracle_emitsStorkOracleUpdated() public {
        address newOracle = makeAddr("newOracle");

        // Use pool as representative ChariotBase inheritor
        address oldOracle = pool.storkOracle();

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit ChariotBase.StorkOracleUpdated(oldOracle, newOracle);

        pool.setStorkOracle(newOracle);
        vm.stopPrank();
    }

    /// @notice CircuitBreakerUpdated is emitted when admin sets the circuit breaker address
    function test_setCircuitBreaker_emitsCircuitBreakerUpdated() public {
        address newBreaker = makeAddr("newBreaker");
        address oldBreaker = pool.circuitBreaker();

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit ChariotBase.CircuitBreakerUpdated(oldBreaker, newBreaker);

        pool.setCircuitBreaker(newBreaker);
        vm.stopPrank();
    }

    /// @notice CircuitBreakerTriggered is emitted when operator triggers circuit breaker
    function test_triggerCircuitBreaker_emitsCircuitBreakerTriggered() public {
        uint8 level = 1;

        vm.startPrank(admin);

        vm.expectEmit(true, true, true, true);
        emit ChariotBase.CircuitBreakerTriggered(level, admin);

        pool.triggerCircuitBreaker(level);
        vm.stopPrank();
    }

    /// @notice CircuitBreakerResumed is emitted when admin resumes normal operation
    function test_resumeCircuitBreaker_emitsCircuitBreakerResumed() public {
        // First trigger the circuit breaker
        vm.startPrank(admin);
        pool.triggerCircuitBreaker(1);

        vm.expectEmit(true, true, true, true);
        emit ChariotBase.CircuitBreakerResumed(admin);

        pool.resumeCircuitBreaker();
        vm.stopPrank();
    }

    // ================================================================
    // 8. InterestRateModel Events
    // ================================================================

    /// @notice RateModelParametersUpdated is emitted when admin sets rate model parameters
    function test_setParameters_emitsRateModelParametersUpdated() public {
        uint256 optUtil = 0.85e18;
        uint256 slope1 = 0.05e18;
        uint256 slope2 = 0.8e18;
        uint256 rf = 0.15e18;

        vm.expectEmit(true, true, true, true);
        emit InterestRateModel.RateModelParametersUpdated(optUtil, slope1, slope2, rf);

        // rateModel deployer is address(this) which has DEFAULT_ADMIN_ROLE
        rateModel.setParameters(optUtil, slope1, slope2, rf);
    }
}
