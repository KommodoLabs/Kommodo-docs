---
sidebar_position: 2
---

# Unit Tests

**Files:** `test/Kommodo_test.js`, `test/Kommodo_gas.js`\
**Framework:** Hardhat + Chai (Waffle provider)

## Test Environment

Both test files share the same setup pattern. Before each suite, a full local environment is deployed:

- **WETH9** and a mock **ERC-20 token** (`Token`) as the pair assets.
- A complete **Uniswap V3** stack: factory, swap router, NFT position descriptor, and NonfungiblePositionManager.
- A **Uniswap V3 pool** initialized at a 1:1 price (`encodePriceSqrt(1, 1)`) with the 500 bps fee tier.
- A **mock Router** (`contracts/test/Router.sol`) used to execute swaps directly against the pool in solvency tests.
- **KommodoFactory** deployed with `multiplier = 5`.
- A **Kommodo** pool created via `KommodoFactory.createKommodo` for the token pair.
- A **NonfungibleLendManager** pointed at the factory.

Token addresses are sorted canonically before pool creation so `token0 < token1` always holds.

---

## Kommodo_test.js

### Suite: `Kommodo_test_happy`

Happy-path tests for core lender and borrower flows, executed sequentially as state carries between tests.

---

#### `Should provide liquidity`

Verifies that `Kommodo.provide` correctly mints a position in the underlying Uniswap V3 pool.

- Calls `provide` with a `liquidity` amount and `amountMaxA` cap.
- Asserts the Uniswap V3 pool position liquidity matches `assets.liquidity`.
- Asserts `tokenA` balance of the lender decreased by exactly the deposited amount.
- Verifies that `kommodoFactory.factory` and `kommodo.factory` both point to the Uniswap V3 factory.

---

#### `Should take liquidity`

Verifies that `Kommodo.take` removes liquidity from the pool and stages tokens for withdrawal.

- Calls `take` with half the available (unlocked) liquidity.
- Asserts the Uniswap V3 pool position liquidity matches the updated `assets.liquidity`.
- Asserts `pool.tokensOwed0 == 0` (tokens collected into the contract).
- Asserts `withdraws.amountA` equals the expected withdrawn amount.
- Asserts the lender's token balance has not changed yet (tokens staged, not transferred).

---

#### `Should open loan`

Verifies that `Kommodo.open` locks liquidity and transfers borrowed tokens to the borrower.

- Records balances before opening.
- Calls `open` with `token0 = false` (tokenB as collateral), borrowing all available liquidity.
- Asserts `tokenA` balance increased (tokens borrowed from the pool).
- Asserts `tokenB` balance decreased by `colAmount + fee + interest`.
- Asserts `assets.locked == liquidityBor`.
- Asserts `assets.feeGrowth1X128` increased by the opening fee, distributed as fee growth to lenders.
- Asserts `borrower.liquidityBor`, `borrower.interest`, and `borrower.start` are stored correctly.

---

#### `Should increase interest loan`

Verifies that `setInterest` with a positive delta deposits additional interest and resets the accrual clock.

- Calls `setInterest` with `delta = +2`.
- Asserts `loan.interest` equals `previous + 2 - 1` (minus 1 for one second of accrued interest rounded up).
- Asserts `tokenB` balance decreased by 2.

---

#### `Should decrease interest loan`

Verifies that `setInterest` with a negative delta withdraws interest and resets the accrual clock.

- Calls `setInterest` with `delta = -2`.
- Asserts `loan.interest` equals `previous - 2 - 1`.
- Asserts `tokenB` balance increased by 2.

---

#### `Should [partial]close loan`

Verifies that `Kommodo.adjust` repays part of a loan and releases the corresponding collateral.

- Calls `adjust` to repay half the borrowed liquidity with `amountCol = 0`.
- Asserts `tokenA` balance decreased by the repaid amount.
- Asserts `tokenB` balance unchanged (no collateral withdrawn).
- Asserts `loan.liquidityBor` is halved.
- Asserts `loan.interest` is reduced by accrued interest since open.
- Asserts `loan.start` is updated to the current block timestamp.

---

#### `Should [full]close loan`

Verifies that `Kommodo.close` fully repays a loan, releases all collateral, and clears the loan record.

- Calls `close` to fully close the remaining position.
- Asserts `tokenA` balance is approximately restored (minus rounding).
- Asserts `tokenB` balance reflects paid interest.
- Asserts `borrower.liquidityBor`, `borrower.interest`, and `borrower.start` are all `0`.
- Asserts `assets.locked == 0` and total liquidity is unchanged.

---

#### `Should provide correct interest`

Verifies the interest accrual and expiry mechanics end-to-end.

- Opens a loan with a fixed `interest = 10`.
- Asserts `getLoanEnd` returns the correct Unix expiry timestamp based on the annual rate formula.
- Asserts `getInterest(amount, start, end) == interest`.
- Asserts that `account2` (non-owner) cannot close an active, solvent loan (`"close: not authorized"`).
- Fast-forwards to halfway through the loan duration using Hardhat `time.increase`.
- Asserts remaining interest is approximately half.
- Verifies that withdrawing more interest than available reverts with a panic (underflow).
- Withdraws the remaining interest via `setInterest(-4)` and asserts `loan.interest == 0`.
- Fast-forwards past expiry and asserts that a third party can now close the position.

---

#### `Should store feegrowth lender`

Verifies that calling `withdraw` updates the lender's fee growth checkpoint and transfers the correct accrued yield.

- Checks that `lender.feeGrowth0X128` and `lender.feeGrowth1X128` start at 0.
- Calls `withdraw` after a loan cycle has distributed fees.
- Asserts `lender.feeGrowth1X128` is updated to match `assets.feeGrowth1X128`.
- Asserts the tokenB balance change equals `delta * lender.liquidity / Q128`.

---

#### `Should change feegrowth after swap`

Verifies that Uniswap V3 swap fees earned by a Kommodo lend position are captured and credited on the next `provide` call.

- Deposits a large liquidity position via `provide`.
- Executes a large swap through the pool using the mock router.
- Asserts `pool.feeGrowthGlobal1X128` increased.
- Calls `provide` again (with `liquidity = 1`) to trigger a fee harvest.
- Asserts the Uniswap V3 position `feeGrowthInside1LastX128` increased.
- Asserts `withdraws.amountB > 0` for the lender.

---

#### `Should pay interest lender after swap passing tick`

Verifies that a swap that crosses the lend tick triggers fee collection when `withdraw` is next called.

- Provides liquidity above the current tick.
- Executes a large swap that crosses the lend tick.
- Calls `withdraw` and asserts the lender received tokenB (swap fees).

---

### Suite: `Kommodo_test_unhappy`

Negative tests verifying that invalid inputs and unauthorized operations revert correctly.

---

#### `Should fail provide for zero amountA and amountB`

Asserts that `provide` with `liquidity = 0` reverts (Uniswap V3 pool rejects zero-liquidity mints).

---

#### `Should fail provide if pool does not exist`

- Creates a Kommodo pool for a fake token pair that has no corresponding Uniswap V3 pool.
- Asserts that `provide` on the resulting Kommodo reverts (call to `slot0` on a non-existent contract fails).

---

#### `Should fail provide if ticklower >= tickmax`

Asserts that `provide` with `tickLower` near `MAX_TICK` reverts (`TickMath.getSqrtRatioAtTick` overflow).

---

#### `Should fail take no position`

Asserts that `take` called by an account with no existing lending position reverts with a panic (arithmetic underflow on `lender.liquidity`).

---

#### `Should fail take locked liquidity`

- Opens a loan that locks all available liquidity.
- Asserts that `take` reverts with `"take: insufficient liquidity"`.

---

#### `Should fail open for insufficient funds`

Asserts that `open` called by an account with no token balance reverts with `"STF"` (safe transfer failure).

---

#### `Should fail adjust non existent loan`

Asserts that `adjust` with no open loan reverts with `"adjust: no open loan"`.

---

#### `Should fail close non existent loan`

Asserts that `close` with no open loan reverts with `"close: no open loan"`.

---

#### `Should fail close non owner active loan`

- Opens a loan from `account2`.
- Asserts that `account3` cannot close it while it is still solvent, reverting with `"close: not authorized"`.

---

### Suite: `Kommodo_NFT_Lender_test_happy`

Happy-path tests for the `NonfungibleLendManager`.

---

#### `Should mint NFT`

- Approves the pool via `poolApprove`.
- Calls `mint` to create a new NFT lending position.
- Asserts an NFT is minted to `account2` with `tokenId = 1`.
- Asserts `nft_position.pool == kommodo.address`.
- Asserts `nft_position.liquidity == assets.liquidity`.
- Asserts `nft_position.locked == nft_position.liquidity` (same-block lock active).

---

#### `Should provide NFT`

- Calls `provide` on `tokenId = 1` to add more liquidity.
- Asserts `tokenA` balance decreased by the deposit amount.
- Asserts NFT position liquidity equals the updated pool liquidity.

---

#### `Should take NFT`

- Calls `take` to remove half the NFT position's liquidity and flush pending balances to `account2`.
- Asserts `nft_position.liquidity` is halved.
- Asserts the Kommodo pool liquidity matches the NFT position.
- Asserts `tokenA` balance of the recipient increased by the withdrawn amount.

---

#### `Should withdraw NFT`

- Opens and immediately closes a loan via `Kommodo` directly to generate fee growth.
- Asserts `assets.feeGrowth1X128` increased.
- Calls `NonfungibleLendManager.withdraw` on `tokenId = 1`.
- Asserts the recipient received the correct tokenB yield (accrued interest from the loan cycle).

---

### Suite: `Kommodo_test_solvency_requirement`

Solvency tests verifying that the collateral requirement holds across all four combinations of collateral token and tick-relative borrow position, including the in-range case. Each test:

1. Deposits liquidity at a specific tick.
2. Opens a loan with collateral sized exactly at the solvency boundary.
3. Moves the pool price to the extreme (min or max `sqrtPrice`) via a swap.
4. Closes the loan and asserts the borrower's net repayment is less than the collateral value, denominated in both token0 and token1.

| Test | Collateral | CLP Tick | Price Movement |
|---|---|---|---|
| `Collateral token0 - borrow CLP tick > current tick - tick increases above` | token0 | Above current | Price moves above CLP tick |
| `Collateral token0 - borrow CLP tick < current tick - tick decreases below` | token0 | Below current | Price moves below CLP tick |
| `Collateral token1 - borrow CLP > current tick - tick increases above` | token1 | Above current | Price moves above CLP tick |
| `Collateral token1 - borrow CLP < current tick - tick decreases below` | token1 | Below current | Price moves below CLP tick |
| `Collateral token0 - borrow CLP inside current tick - tick decreases below` | token0 | Straddles current | Price moves below CLP tick |
| `Collateral token1 - borrow CLP inside current tick - tick increases above` | token1 | Straddles current | Price moves above CLP tick |

---

## Kommodo_gas.js

A single test suite (`Kommodo_gas`) that estimates and logs gas costs for every significant protocol operation. No assertions are made on correctness — results are printed to the console for benchmarking. Uses `estimateGas` before executing each transaction to capture both cold (first interaction) and warm (subsequent interaction) costs.

| Operation | Cold / Warm | Description |
|---|---|---|
| `KommodoFactory.createKommodo` | Cold | Deploy a new Kommodo pool. |
| `Kommodo.provide` | Cold | First `provide` — mints a new Uniswap V3 position. |
| `Kommodo.provide` | Warm | Subsequent `provide` — adds to an existing position. |
| `Kommodo.take` | — | Remove half the lender's liquidity. |
| `Kommodo.withdraw` | — | Collect staged token balances. |
| `Kommodo.open` | Cold | Open a loan — first time minting into the AMM tick. |
| `Kommodo.open` | Warm | Open a loan — tick position already exists. |
| `Kommodo.setInterest` | — | Adjust interest with `delta = -1`. |
| `Kommodo.adjust` | — | Partial repayment (`liquidityBor = 1`). |
| `Kommodo.close` | — | Full loan close. |
| `NonfungibleLendManager.poolApprove` | — | Grant ERC-20 approvals for the manager. |
| `NonfungibleLendManager.mint` | Cold | Mint a new NFT position — new AMM position. |
| `NonfungibleLendManager.mint` | Warm | Mint a new NFT position — AMM position exists. |
| `NonfungibleLendManager.provide` | — | Add liquidity to an existing NFT position. |
| `NonfungibleLendManager.take` | — | Remove all liquidity from an NFT position. |
| `NonfungibleLendManager.withdraw` | — | Collect pending balances from an NFT position. |
| `NonfungibleLendManager.burn` | — | Burn an empty NFT. |
