---
sidebar_position: 3
---

# Fuzz Tests

**File:** `test_other/Kommodo_fuzz.t.sol`\
**Framework:** Foundry (Forge) — `forge-std/Test.sol`

## Test Environment

The suite forks a local Hardhat node (`http://127.0.0.1:8545`) using `vm.createSelectFork` and connects to contracts already deployed on that node. This means the fuzz tests run against the same deployed state as the Hardhat integration tests rather than re-deploying from scratch.

Two dedicated accounts are used:

| Account | Address | Role |
|---|---|---|
| `lender` | `0x100` | Provides liquidity to Kommodo. |
| `borrower` | `0x200` | Opens and closes loans. |

Both are funded with 1000 ETH via `vm.deal`. In `setUp`, each account deposits 100 ETH worth of both `weth` and `weth2` and approves the Kommodo pool to spend them.

**Pre-deployed contracts used:**

| Contract | Address |
|---|---|
| WETH9 (token0) | `0xe7f1...` |
| WETH9 (token1) | `0xCf7E...` |
| UniswapV3Factory | `0x5FbD...` |
| NonfungiblePositionManager | `0x9fE4...` |
| UniswapV3Pool | `0x949f...` |
| MockRouter | `0x5FC8...` |
| KommodoFactory | `0xa513...` |
| KommodoPool | `0x9bd0...` |
| NonfungibleLendManager | `0x8A79...` |

---

## Fuzz Tests

All stateful fuzz tests take a single `uint128 depositAmount` parameter (or `int256` where noted) as the fuzz input. Foundry generates random values for this parameter across many runs. Each test uses `bound` to constrain the input to a meaningful range before executing.

---

### `test_fuzz_kommodo_provide`

**Input:** `depositAmount` bounded to `[1, 100 ether]`

Verifies that `provide` correctly stores the lender's position for any valid liquidity amount.

**Setup:** Records lender WETH and WETH2 balances before the call.

**Action:** Calls `kommodoPool.provide` with `tickLower = currentTick + spacing`, `liquidity = depositAmount`, and `amountMaxA = depositAmount`.

**Assertions:**
- `assets.liquidity != 0`
- `lender.liquidity != 0`
- `lender.liquidity == depositAmount`
- `assets.liquidity == lender.liquidity`
- WETH2 (token deposited) balance decreased (`balanceWETH2_before - balanceWETH2_after > 0`)
- WETH balance unchanged

---

### `test_fuzz_kommodo_take`

**Input:** `depositAmount` bounded to `[1, 100 ether]`

Verifies that `take` fully removes a lender position and leaves balances unchanged until `withdraw` is called.

**Setup:** Calls `provide` with `depositAmount`, then advances one block (`vm.roll(block.number + 1)`) to release the same-block lock.

**Action:** Calls `kommodoPool.take` with the full `liqPosition_before`.

**Assertions:**
- `assets.liquidity == 0` after take
- `lender.liquidity == 0` after take
- WETH balance unchanged (tokens staged in `withdraws`, not yet transferred)
- WETH2 balance unchanged

---

### `test_fuzz_kommodo_withdraw`

**Input:** `depositAmount` bounded to `[1e6, 100 ether]`

Verifies that `withdraw` transfers the correct token amounts after a full `provide` → `take` cycle.

**Setup:** Calls `provide`, advances one block, calls `take`, then reads `withdraws(tick, lender)` to get the staged amounts.

**Pre-check assertions:**
- `assets.liquidity == 0`
- `lender.liquidity == 0`
- `withdraws.amountA > 0` (WETH2 staged for withdrawal)
- `withdraws.amountB == 0`

**Action:** Calls `kommodoPool.withdraw` with the exact staged amounts.

**Assertions:**
- WETH2 balance increased by exactly `withdrawA`
- WETH balance increased by exactly `withdrawB` (zero in this case)

---

### `test_fuzz_kommodo_open`

**Input:** `depositAmount` bounded to `[1e6, 100 ether]`

Verifies that `open` correctly locks liquidity, stores the loan, and transfers the correct token amounts for any valid deposit size.

**Setup:** Lender calls `provide` with `depositAmount`. Borrower parameters are derived as:
- `collateralAmount = depositAmount / 3 + 10`
- `borrowLiquidity = liqPool / 4`

The 1/3 collateral vs 1/4 borrow ratio ensures the solvency requirement is always satisfied across all fuzz inputs. The `+10` guards against rounding edge cases.

**Action:** Borrower calls `kommodoPool.open` with `token0 = false` (WETH as collateral), `interest = 1`.

**Assertions:**
- `assets.locked == borrowLiquidity`
- `borrower.liquidityBor == borrowLiquidity`
- `borrower.amountCol == collateralAmount`
- `borrower.interest == 1`
- `borrower.start == block.timestamp`
- WETH2 (borrowed token) balance of borrower increased
- WETH (collateral token) balance of borrower decreased by `collateralAmount + fee + 1` (fee rounded up)

---

### `test_fuzz_kommodo_close`

**Input:** `depositAmount` bounded to `[1e6, 100 ether]`

Verifies that `close` fully repays a loan, clears the loan record, and returns collateral for any valid deposit size.

**Setup:** Lender provides `depositAmount`. Borrower opens a loan with `borrowLiquidity = liqPool / 4` and `colAmount = depositAmount / 3 + 10`.

**Pre-check assertions:**
- `assets.locked == borrowLiquidity`
- `borrower.liquidityBor == borrowLiquidity`
- `borrower.amountCol != 0`

**Action:** Borrower calls `kommodoPool.close` with `borAMax = borBMax = type(uint128).max`.

**Assertions:**
- `assets.locked == 0`
- `borrower.liquidityBor == 0`
- `borrower.amountCol == 0`
- `borrower.interest == 0`
- `borrower.start == 0`
- WETH2 balance of borrower decreased (repaid borrowed tokens)
- WETH balance of borrower increased by `collateralAmount + 1` (`+1` is the unused pre-paid interest returned)

---

### `test_fuzz_kommodo_adjust`

**Input:** `depositAmount` bounded to `[1e6, 100 ether]`

Verifies that `adjust` partially repays a loan and returns the correct collateral amount for any valid deposit size.

**Setup:** Lender provides `depositAmount`. Borrower opens a loan with `borrowLiquidity = liqPool / 4` and `colAmount = depositAmount / 3 + 10`.

**Action:** Borrower calls `kommodoPool.adjust` with `liquidityBor = 1`, `amountCol = 2`, `interest = 1`.

**Assertions:**
- `assets.locked == borrowLiquidity - 1`
- `borrower.liquidityBor == borrowLiquidity - 1`
- `borrower.amountCol == depositAmount / 3 + 10 - 2`
- `borrower.interest == 2` (original `1` - accrued `1` + new `2` deposited)
- `borrower.start == block.timestamp`
- WETH2 balance of borrower decreased (repaid 1 unit of liquidity)
- WETH balance of borrower increased by `2 - 1 = 1` (2 collateral withdrawn minus 1 interest deposited)

---

### `test_fuzz_kommodo_setInterest`

**Input:** `depositAmount` bounded to `[1e6, 100 ether]`

Verifies that `setInterest` correctly increases and decreases the pre-paid interest balance for any valid deposit size.

**Setup:** Lender provides `depositAmount`. Borrower opens a loan with `interest = 1`.

**Action 1:** Calls `setInterest(false, tick, +10)` — increases interest.

**Assertions after increase:**
- `loan.interest == 11` (original 1 + 10 deposited, minus 0 accrued at same timestamp)
- WETH balance decreased by 10

**Action 2:** Calls `setInterest(false, tick, -5)` — decreases interest.

**Assertions after decrease:**
- `loan.interest == 6` (11 - 5 withdrawn)
- WETH balance increased by 5

---

### `test_fuzz_kommodo_borrow_interest_withdraw`

**Input:** `depositAmount` bounded to `[1e6, 100 ether]`

Verifies that the opening fee paid by a borrower is correctly distributed to the lender as fee growth and becomes withdrawable.

**Setup:** Lender provides `depositAmount`. Checks that all fee growth accumulators start at 0.

**Action:** Borrower opens a loan, paying an opening fee on `colAmount = depositAmount / 3 + 10`. Lender calls `withdraw(tick, lender, 0, 0)` to trigger a fee growth update without transferring tokens.

**Intermediate assertions:**
- `assets.feeGrowth1X128 != 0` after `open` (opening fee distributed)
- `lender.feeGrowth1X128 != 0` after first `withdraw`
- `withdraws.amountB != 0` (interest staged for lender)

**Action:** Lender calls `withdraw` again with `amountB = 100 ether` to collect the staged yield.

**Final assertions:**
- WETH balance of lender increased
- WETH2 balance of lender unchanged

---

### `test_fuzz_kommodo_swap_fee_withdraw`

**Input:** `depositAmount` (as `int256`) bounded to `[1e6, 100 ether]`

Verifies that swap fees earned by a Kommodo position are accurately captured and match the expected fee growth calculation.

**Setup:** Lender provides `depositAmount`. Transfers tokens to `mockRouter` to fund a swap. Asserts all fee growth starts at 0.

**Action:** Executes a swap via `mockRouter` at maximum `sqrtPrice`, then calls `withdraw(tick, lender, 0, 0)` to harvest fees.

**Assertions:**
- `uniPool.feeGrowthGlobal1X128 != 0` (swap generated fees)
- `uniPool.feeGrowthGlobal0X128 == 0` (only one direction of swap)
- `withdraws.amountB != 0` (fees staged for lender)
- `withdraws.amountA == 0`
- `uniPool.feeGrowthGlobal1X128 == position.feeGrowthInside1LastX128` (Uniswap captured all fees at this tick)
- `lender.feeGrowth1X128 == assets.feeGrowth1X128` (checkpoints match)
- `lender.feeGrowth1X128 == expectedFeeGrowth` where expected is computed as `mulDiv(feeAmount, Q128, liquidity)`
- `withdraws.amountB == expectedFeeAmount` derived from the same formula

---

## Solvency Guarantee Tests

Pure mathematical fuzz tests that verify the solvency invariant holds for all valid inputs without any on-chain state. These tests use `vm.assume` to filter invalid inputs rather than `bound`.

**Invariant tested:** For any position at any price, the collateral value is always greater than or equal to the borrow value — i.e., a loan can always be repaid from the collateral.

---

### `test_kommodo_solvency_guarantee_col0`

**Inputs:** `collateralAmount` (`uint128`), `sqrtRatioAX96` (`uint160`), `sqrtRatioX96` (`uint160`)

**Setup:**
- `sqrtRatioBX96 = 2 * sqrtRatioAX96` (upper tick is derived from lower tick)
- All inputs constrained to valid Uniswap V3 sqrt price bounds
- Overflow guard: intermediate liquidity computation must fit in `uint128`

**Action:** Computes the maximum liquidity purchasable with `collateralAmount` of token0 at the given tick range using `getLiquidityForAmount0`. Derives the borrow value from that liquidity at the current price `sqrtRatioX96`, converting any token1 component to token0 terms using the current price.

**Assertion:** `collateralAmount >= amount0_col0 + amount1_value0`

The collateral (denominated in token0) must always cover the full borrow value (also denominated in token0) at any price.

---

### `test_kommodo_solvency_guarantee_col1`

**Inputs:** `collateralAmount` (`uint128`), `sqrtRatioAX96` (`uint160`), `sqrtRatioX96` (`uint160`)

**Setup:** Same bounds as `col0` test. Overflow guard applied to the token1 liquidity intermediate.

**Action:** Computes the maximum liquidity purchasable with `collateralAmount` of token1 using `getLiquidityForAmount1`. Derives the borrow value at the current price, converting any token0 component to token1 terms.

**Assertion:** `collateralAmount >= amount0_value1 + amount1_col1`

The collateral (denominated in token1) must always cover the full borrow value (also denominated in token1) at any price.
