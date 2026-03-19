---
sidebar_position: 4
---

# Formal Tests

**File:** `test_other/Kommodo_formal.sol`\
**Framework:** Foundry (Forge) — `forge-std/Test.sol`

## Overview

`KommodoTestFormal` is a formal verification test suite designed to be run with a symbolic execution tool such as Halmos or Certora. Functions are prefixed `check_` rather than `test_` so Forge does not execute them as standard unit tests — they are entry points for a symbolic executor that explores all possible inputs simultaneously.

Unlike the fuzz tests, these tests are written to be verified exhaustively over the full input space. `vm.assume` is used to encode preconditions that constrain the symbolic state rather than to filter random samples.

---

## Test Environment

The suite deploys its own isolated environment using Forge cheatcodes, with no dependency on a forked node.

**Constants:**

| Constant | Value | Description |
|---|---|---|
| `MIN_TICK` | `-887272` | Uniswap V3 minimum tick. |
| `MAX_TICK` | `887272` | Uniswap V3 maximum tick. |
| `TICKSPACING` | `10` | Tick spacing used for all pools. |
| `FEE` | `500` | Pool fee tier (0.05%). |

**Addresses:**

| Variable | Address | Description |
|---|---|---|
| `TOKEN0` | `0x1000` | Mock ERC-20 token, etched at a fixed address. |
| `TOKEN1` | `0x2000` | Mock ERC-20 token, etched at a fixed address. |
| `UNI_FACTORY` | `0x3000` | Fake factory address, used only for address derivation. |

**`setUp` procedure:**

1. Computes the deterministic Uniswap V3 pool address from `UNI_FACTORY`, `TOKEN0`, `TOKEN1`, and `FEE` using `CREATE2` with the standard `POOL_INIT_CODE_HASH`.
2. Deploys `MockUniPool` at that address using `vm.etch`, so `Connector` resolves calls to the correct address without a real factory.
3. Deploys mock ERC-20 `Token` contracts at `TOKEN0` and `TOKEN1` via `vm.etch`.
4. Deploys `Kommodo` directly with `multiplier = 5` and `fee = 500` (annual interest rate = 0.25%).

### `MockUniPool`

A minimal stub (`test_other/MockUniPool.sol`) that satisfies the `IUniswapV3Pool` interface required by `Connector`. It returns a fixed `sqrtPriceX96` of `79228162514264337593543950336` (1:1 price) from `slot0`, returns zero from `mint` and `burn`, and exposes a `set_collect(a, b)` function to configure the amounts returned by `collect` and `positions`. This allows formal tests to control the fee amounts the pool reports without executing a real swap.

---

## Tick Sampling

All `check_` functions restrict `tickLower` to one of three representative values to keep the symbolic state space tractable:

```solidity
int24[3] memory allowed = [-600000, TICKSPACING, 600000];
int24 tickLower = allowed[uint256(bound(int24(0), 0, 2))];
```

This covers a below-range tick, a near-current tick, and an above-range tick.

---

## Formal Check Functions

---

### `check_kommodo_lender_provide`

**Inputs:** `amountA` (`uint128`), `amountB` (`uint128`)

**Preconditions:**
- Exactly one of `amountA` or `amountB` is non-zero (single-sided deposit).
- `assets.liquidity == 0` and `lender.liquidity == 0` before the call (clean state).

**Action:** Calls `kommodo.provide` with `liquidity = amountA + amountB`.

**Postconditions:**
- `assets.liquidity != 0`
- `lender.liquidity != 0`
- `lender.blocknumber != 0`
- `lender.liquidity == amountA + amountB`
- `assets.liquidity == lender.liquidity`
- `lender.locked == lender.liquidity` (full same-block lock applied)

---

### `check_kommodo_lender_take`

**Inputs:** `amountA` (`uint128`), `amountB` (`uint128`)

**Preconditions:**
- Exactly one of `amountA` or `amountB` is non-zero.
- After `provide`: `assets.liquidity > 0`, `assets.liquidity == lender.liquidity`, `lender.locked == lender.liquidity`.
- `block.number > 0` and `lender.blocknumber == block.number` (position was just provided in this block).
- Block is advanced by 1 (`vm.roll(block.number + 1)`) to release the same-block lock.
- `lender.blocknumber < block.number` confirmed after the roll.
- `take.liquidity == lender.locked` confirmed before calling.

**Action:** Calls `kommodo.take` with the full `liqPosition_before`.

**Postconditions:**
- `assets.liquidity == 0`
- `lender.liquidity == 0`
- `lender.locked == 0`
- `lender.blocknumber != 0` (updated to current block)

---

### `check_kommodo_borrow_open`

**Inputs:** `amountA` (`uint128`), `amountB` (`uint128`)

**Preconditions:**
- Exactly one of `amountA` or `amountB` is non-zero.
- Lender mints `type(uint128).max` of both tokens and provides `amountA + amountB` liquidity.
- `assets.liquidity > 0`, `assets.locked == 0`.
- `borrower.liquidityBor == 0` (no existing loan for the borrower address `0x2`).

**Action:** Borrower (`0x2`) calls `kommodo.open` with:
- `token0 = true` (TOKEN0 as collateral)
- `liquidityBor = assets.liquidity` (borrow everything)
- `colAmount = amountA + amountB`
- `interest = 100`

**Postconditions:**
- `assets.liquidity == assets.liquidity_before` (total liquidity unchanged)
- `assets.locked == assets.liquidity` (all liquidity now locked)
- `borrower.liquidityBor == assets.liquidity`
- `borrower.interest == 100`
- `borrower.start != 0`

---

### `check_kommodo_borrow_close`

**Inputs:** `liquidity` (`uint128`)

**Preconditions:**
- `liquidity > 0`
- Lender mints `type(uint128).max` and provides `type(uint128).max` liquidity.
- `assets.locked == 0`, no existing borrower loan.
- Borrower mints `type(uint128).max`, opens a loan with `liquidityBor = liquidity` and `colAmount = type(uint128).max / 1e6`.
- `borrower.liquidityBor == liquidity` confirmed before closing.

**Action:** Borrower calls `kommodo.close`.

**Postconditions:**
- `assets.liquidity == liquidity_open_before` (pool liquidity fully restored)
- `assets.locked == 0`
- `borrower.liquidityBor == 0`
- `borrower.interest == 0`
- `borrower.start == 0`

---

### `check_kommodo_borrow_adjust`

**Inputs:** `liquidity` (`uint128`), `liquidity_adjust` (`uint128`)

**Preconditions:**
- `liquidity > 0`
- Lender provides `type(uint128).max` liquidity. Pool state is clean (no locked, no existing loan).
- Borrower opens a loan with `liquidityBor = liquidity` and `colAmount = type(uint128).max / 1e6`.
- `liquidity_adjust > 0` and `liquidity_adjust < liquidity` (partial repayment only).

**Action:** Borrower calls `kommodo.adjust` with `liquidityBor = liquidity_adjust`, `amountCol = 1`, `interest = 90`.

**Postconditions:**
- `assets.liquidity == liquidity_open_before` (total pool liquidity unchanged)
- `borrower.liquidityBor == liquidity - liquidity_adjust`
- `borrower.amountCol == type(uint128).max / 1e6 - 1`
- `borrower.start != 0`

---

### `check_kommodo_feegrowth_interest`

**Inputs:** `liquidity` (`uint128`)

**Preconditions:**
- `liquidity > 0`
- Lender provides `type(uint128).max` liquidity.
- All fee growth accumulators start at 0: `assets.feeGrowth0X128 == 0`, `assets.feeGrowth1X128 == 0`, `lender.feeGrowth0X128 == 0`, `lender.feeGrowth1X128 == 0`.
- `assets.locked == 0`, no existing borrower loan.

**Action:** Borrower opens a loan with `token0 = false` (TOKEN1 as collateral), `colAmount = type(uint128).max / 1e6`, `interest = 1`. The opening fee is distributed as `feeGrowth1X128`. Lender then calls `withdraw(tick, lender, 0, 0)` to trigger a fee growth update.

**Postconditions:**
- `withdraws.amountA == 0` (no TOKEN0 fee, collateral was TOKEN1)
- `withdraws.amountB > 0` (opening fee distributed as TOKEN1 fee growth, now staged for lender)

---

### `check_kommodo_feegrowth_swap`

**Inputs:** `amountA` (`uint128`), `amountB` (`uint128`)

**Preconditions:**
- `amountA > 1` and `amountB > 1`
- Lender provides `type(uint128).max` liquidity.
- All fee growth accumulators start at 0.

**Action:** Calls `MockUniPool.set_collect(amountA, amountB)` to configure the mock pool to return `amountA` and `amountB` from `collect`. This simulates swap fees accumulating in the position without executing a real swap. Lender then calls `kommodo.withdraw(tick, lender, 0, 0)`, which internally calls `updateFeeGrowth` — harvesting the mocked fees and updating `assets.feeGrowth0X128` and `assets.feeGrowth1X128`.

**Postconditions:**
- `assets.feeGrowth0X128 > 0`
- `assets.feeGrowth1X128 > 0`
- `lender.feeGrowth0X128 == assets.feeGrowth0X128` (lender checkpoint synced)
- `lender.feeGrowth1X128 == assets.feeGrowth1X128`

> Note: The actual `withdraws` token amounts are not asserted here due to the number of execution paths. The test verifies fee growth accounting correctness indirectly through the checkpoint sync.
