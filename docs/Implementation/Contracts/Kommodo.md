---
sidebar_position: 3
---
# Kommodo

**Source:** `contracts/Kommodo.sol`\
**Interface:** `contracts/interfaces/IKommodo.sol`\
**License:** GPL-3.0-or-later

## Overview

`Kommodo` is the core lending pool contract. Each instance is bound to a single Uniswap V3 token pair and fee tier, and uses that pool's concentrated liquidity positions as the primitive for both lending and borrowing. Lenders deposit liquidity into specific price ticks; borrowers lock that liquidity as collateral backing and withdraw the underlying tokens. Interest accrues continuously and is distributed pro-rata to lenders as fee growth.

Pools are deployed and registered exclusively through [`KommodoFactory`](./KommodoFactory.md). `Kommodo` inherits from `Connector`, which handles all direct interactions with the Uniswap V3 pool (mint, burn, collect).

## Constructor

```solidity
constructor(IKommodo.CreateParams memory params)
```

| Parameter | Type | Description |
|---|---|---|
| `params.factory` | `address` | Uniswap V3 factory address, forwarded to `Connector`. |
| `params.tokenA` | `address` | Canonical `token0` of the pair (lower address). |
| `params.tokenB` | `address` | Canonical `token1` of the pair (higher address). |
| `params.tickSpacing` | `int24` | Tick spacing of the Uniswap V3 pool for the given fee tier. |
| `params.fee` | `uint24` | Uniswap V3 fee tier (e.g., `500`, `3000`, `10000`). Also used as the opening fee and collateral safety margin. |
| `params.multiplier` | `uint24` | `interest = multiplier * fee`. Must satisfy `multiplier * fee <= 1e6`. |

## State

### Pool Parameters

| Variable | Type | Description |
|---|---|---|
| `tokenA` | `address` | Token0 of the underlying Uniswap V3 pool. |
| `tokenB` | `address` | Token1 of the underlying Uniswap V3 pool. |
| `fee` | `uint24` | Fee tier of the underlying pool. |
| `tickSpacing` | `int24` | Tick spacing; defines valid tick boundaries for positions. |
| `interest` | `uint24` | Annual interest rate in ppm (`multiplier * fee`). |

### Lender Mappings

| Variable | Type | Description |
|---|---|---|
| `assets` | `mapping(int24 => Assets)` | Aggregate liquidity and fee growth state per tick. |
| `lender` | `mapping(int24 => mapping(address => Lender))` | Per-lender liquidity, locked liquidity, and fee growth checkpoints per tick. |
| `withdraws` | `mapping(int24 => mapping(address => Withdraws))` | Pending token withdrawal balances per lender per tick. |

### Borrower Mappings

| Variable | Type | Description |
|---|---|---|
| `borrower` | `mapping(bytes32 => Loan)` | Loan state keyed by `getKey(owner, tickBor, token0)`. |

## Data Structures

### `Assets`
Aggregate state for a tick's lending pool.

| Field | Type | Description |
|---|---|---|
| `liquidity` | `uint128` | Total liquidity provided at this tick. |
| `locked` | `uint128` | Liquidity currently locked by active loans. |
| `feeGrowth0X128` | `uint256` | Cumulative fee growth per unit liquidity for tokenA (Q128). |
| `feeGrowth1X128` | `uint256` | Cumulative fee growth per unit liquidity for tokenB (Q128). |

### `Lender`
Per-address state for a lending position.

| Field | Type | Description |
|---|---|---|
| `liquidity` | `uint128` | Lender's total liquidity at this tick. |
| `locked` | `uint128` | Lender's liquidity locked in the same block as the last action (flash-loan protection). |
| `feeGrowth0X128` | `uint256` | Fee growth checkpoint for tokenA at last interaction. |
| `feeGrowth1X128` | `uint256` | Fee growth checkpoint for tokenB at last interaction. |
| `blocknumber` | `uint256` | Block number of the last `provide` or `take` call. |

### `Loan`
State for an open borrow position.

| Field | Type | Description |
|---|---|---|
| `liquidityBor` | `uint128` | Liquidity units borrowed. |
| `amountCol` | `uint128` | Collateral amount deposited (in collateral token). |
| `interest` | `uint128` | Pre-paid interest balance remaining. |
| `start` | `uint256` | Timestamp of the last interest settlement. |

## Functions

### `provide`

```solidity
function provide(ProvideParams calldata params) public
```

Deposits liquidity into the Uniswap V3 pool at a single-tick-width position (`[tickLower, tickLower + tickSpacing]`) and records the lender's share.

| Parameter | Description |
|---|---|
| `params.tickLower` | Lower bound of the position. Must be a valid tick for the pool's tick spacing. |
| `params.liquidity` | Liquidity units to deposit. |
| `params.amountMaxA` | Maximum tokenA to spend (slippage protection). |
| `params.amountMaxB` | Maximum tokenB to spend (slippage protection). |

Fee growth is updated before recording the position. The `locked` field is set to the full deposited liquidity for the remainder of the block, preventing same-block withdraw.

**Reverts:** `"provide: insufficient amount"`, `"provide: max amount deposit"`

**Emits:** `Provide(owner, tickLower, liquidity, amountA, amountB)`

---

### `take`

```solidity
function take(TakeParams calldata params) public returns (uint256 amountA, uint256 amountB)
```

Removes the caller's liquidity from the Uniswap V3 pool and stages the proceeds in `withdraws` for collection via `withdraw`. Only unlocked liquidity (`assets.liquidity - assets.locked`) may be removed.

| Parameter | Description |
|---|---|
| `params.tickLower` | Tick of the position to remove liquidity from. |
| `params.liquidity` | Liquidity units to remove. |
| `params.amountMinA` | Minimum tokenA to receive (slippage protection). |
| `params.amountMinB` | Minimum tokenB to receive (slippage protection). |

**Reverts:** `"take: insufficient liquidity"`, `"take: insufficient amounts"`, `"take: withdraw locked"`

**Emits:** `Take(owner, tickLower, liquidity, amountA, amountB)`

---

### `withdraw`

```solidity
function withdraw(int24 tickLower, address recipient, uint128 amount0Requested, uint128 amount1Requested) public
```

Transfers pending token balances (accrued fees + proceeds from `take`) from `withdraws` to `recipient`. Triggers a fee update before transferring. Partial withdrawals are supported — amounts are capped to the available balance.

**Emits:** `Withdraw(owner, tickLower, amountA, amountB)`

---

### `open`

```solidity
function open(OpenParams calldata params) public
```

Opens a borrow position by depositing collateral and withdrawing the equivalent borrowed liquidity from the pool.

| Parameter | Description |
|---|---|
| `params.token0` | `true` to use tokenA as collateral, `false` for tokenB. |
| `params.tickBor` | Tick of the liquidity position to borrow from. |
| `params.liquidityBor` | Liquidity units to borrow. |
| `params.borAMin` / `params.borBMin` | Minimum amounts of tokenA/tokenB to receive (slippage protection). |
| `params.colAmount` | Collateral amount to deposit. |
| `params.interest` | Initial pre-paid interest to deposit (in collateral token). |

**Collateral requirement:** `colAmount * 1e6 / (fee + 1e6) >= borrowedAmount`. The fee percentage acts as a combined opening fee and safety margin.

**Opening fee:** `getFee(colAmount)` is charged on top of `colAmount` and immediately distributed to lenders as fee growth.

**Reverts:** `"open: no zero fee"`, `"open: unsufficient amount"`, `"open: insufficient liquidity"`, `"open: insufficient collateral for borrow"`

**Emits:** `Open(token0, owner, tickBor, liquidityBor, amountCol, interest, borA, borB)`

---

### `adjust`

```solidity
function adjust(AdjustParams calldata params) public
```

Partially repays a loan: returns some borrowed liquidity to the pool and withdraws the corresponding portion of collateral. Interest is settled up to the current timestamp before the adjustment. Solvency is re-checked after the adjustment.

| Parameter | Description |
|---|---|
| `params.token0` | Collateral token side of the loan. |
| `params.tickBor` | Tick of the borrow position. |
| `params.liquidityBor` | Liquidity units to repay. |
| `params.borAMax` / `params.borBMax` | Maximum tokenA/tokenB to repay (slippage protection). |
| `params.amountCol` | Collateral amount to withdraw. |
| `params.interest` | Interest delta to add (positive) or remove (negative). |

**Authorization:** Only the loan owner may adjust their position.

**Reverts:** `"adjust: no open loan"`, `"adjust: max amount repay"`, `"open: insufficient collateral for borrow"`

**Emits:** `Adjust(token0, owner, tickBor, liquidityBor, amountCol, interest, borA, borB)`

---

### `close`

```solidity
function close(CloseParams calldata params) public
```

Fully closes a loan: repays the borrowed liquidity, returns collateral to the caller, and refunds any unused pre-paid interest.

| Parameter | Description |
|---|---|
| `params.token0` | Collateral token side of the loan. |
| `params.owner` | Address of the loan owner. |
| `params.tickBor` | Tick of the borrow position. |
| `params.borAMax` / `params.borBMax` | Maximum tokenA/tokenB to repay (slippage protection). |

**Authorization:** Only the loan owner may close their position. Any caller may close a position if the pre-paid interest has been fully consumed (`used > loan.interest`), enabling liquidation.

**Reverts:** `"close: no open loan"`, `"close: not authorized"`, `"adjust: max amount repay"`

**Emits:** `Close(token0, sender, owner, tickBor, liquidityBor, amountCol, borA, borB)`

---

### `setInterest`

```solidity
function setInterest(bool token0, int24 tickBor, int128 delta) public
```

Adjusts the pre-paid interest balance for the caller's loan at the given tick through an internal function call `storeInterest`. Settles accrued interest since `loan.start` before applying the delta. A positive `delta` deposits additional interest tokens; a negative `delta` withdraws the excess.

**Reverts:** `"storeInterest: unclosed loan"` if the current accrued interest already exceeds the pre-paid balance.

---

### `updateInterest`

```solidity
function updateInterest(bool token0, int24 tickBor, address owner) public
```

Update the used interest balance for the owners loan at the given tick, can be called by anyone. Settles accrued interest since `loan.start` and updates `loan.start` to current timestamp. 

**Reverts:** `"updateInterest: unclosed loan"` if the current accrued interest already exceeds the pre-paid balance.

---

### `checkRequirement`

```solidity
function checkRequirement(bool token0, int24 tickBor, int128 liquidity, uint128 col)
    public view returns (bool success)
```

Returns `true` if the collateral amount satisfies the solvency requirement for the given borrow position. The effective collateral threshold is `col * 1e6 / (fee + 1e6)`, compared against the token amount implied by `liquidity` at `tickBor`.

---

### `getFee`

```solidity
function getFee(uint256 amount) public view returns (uint256)
```

Returns the opening fee for a given collateral amount: `ceil(amount * fee / 1e6)`.

---

### `getInterest`

```solidity
function getInterest(uint256 amount, uint256 start, uint256 end) public view returns (uint256)
```

Computes accrued interest for a collateral amount over a time interval:

```
interest = ceil(amount * interest / 1e6) * (end - start) / 31536000
```

---

### `getLoanEnd`

```solidity
function getLoanEnd(address owner, int24 tickBor, bool token0) public view returns (uint256)
```

Returns the Unix timestamp at which the pre-paid interest for a loan will be exhausted, assuming the current accrual rate:

```
end = loan.start + (loan.interest * 31536000) / (loan.amountCol * interest / 1e6)
```

---

### `getKey`

```solidity
function getKey(address owner, int24 tickBor, bool token0) public pure returns (bytes32)
```

Returns the `borrower` mapping key for a loan: `keccak256(abi.encode(owner, tickBor, token0))`.

## Fee & Interest Model

- **Opening fee:** Charged as `getFee(colAmount)` on `open`. Paid on top of collateral and immediately distributed to all lenders at that tick.
- **Annual interest rate:** Fixed at `interest = multiplier * fee`. For example, `multiplier = 10` and `fee = 3000` gives a 3% annual rate.
- **Pre-paid interest:** Borrowers deposit interest upfront. Accrual is computed linearly per second. When the balance is exhausted the position becomes eligible for third-party unwind via `close`.
- **Lender yield:** All fees (opening fees + accrued interest) accumulate in `assets.feeGrowth0X128` / `assets.feeGrowth1X128` and are claimable pro-rata via `withdraw`.

## Integration Notes

- **Tick boundaries:** All positions span exactly one tick interval: `[tickLower, tickLower + tickSpacing]`. 
- **Same-block flash protection:** Liquidity deposited via `provide` is locked for the remainder of the block and cannot be immediately removed by `take`.
- **Loan keys:** Use `getKey(owner, tickBor, token0)` to look up any loan in the `borrower` mapping.
- **Unwind:** Any caller can invoke `close` once `getInterest(loan.amountCol, loan.start, block.timestamp) > loan.interest`.
- **Slippage protection:** All functions that interact with the Uniswap V3 pool accept `amountMin` / `amountMax` parameters. Always set these to meaningful values in production.
- **Reentrancy protection:** All public calls for `Kommodo.sol` and `NonfungibleLendManager` are protected against reentrancy via `ReentrancyGuard`. 