---
sidebar_position: 3
---

# Kommodo
The main protocol contract. It manages all lending and borrowing state and delegates all liquidity operations to the Uniswap V3 pool via the `Connector` layer. Key data structures:

| Struct | Purpose |
|--------|---------|
| `Assets` | Per-tick aggregate state: total liquidity, locked liquidity, fee growth accumulators |
| `Lender` | Per-lender position: liquidity share, fees earned, block-based lock |
| `Loan` | Borrower state: borrowed liquidity, collateral, accrued interest, start timestamp |
| `Withdraws` | Pending lender withdrawals waiting to be claimed |

---

## Lending Mechanism
Lenders call `provide(tickLower, amountA, amountB)` to deposit tokens into a Uniswap V3 position at a target tick. The protocol tracks each lender's fractional share of the tick's total liquidity. Liquidity provided in block `N` is locked for that block and can only be withdrawn starting in block `N+1`, preventing same-block manipulation.

Lenders earn two sources of yield:
1. **AMM swap fees** collected by the underlying Uniswap V3 position
2. **Borrower interest payments** that flow into the tick's fee growth accumulators

Fee accounting uses Uniswap V3's `feeGrowthInside0X128` / `feeGrowthInside1X128` pattern. Each lender's earnings are calculated as their liquidity share multiplied by the fee growth accumulated since their last checkpoint.

Lenders can exit with `take()` to initiate a withdrawal and `withdraw()` to claim fees and principal. Withdrawals are blocked on the portion of liquidity currently locked by active loans.

---

## Borrowing Mechanism

Borrowers call `open(tickBor, liquidityBor, colAmount, interest)` to open a loan. The protocol:

1. Validates that the provided collateral meets the minimum requirement via `checkRequirement()`
2. Collects an opening fee proportional to the borrowed liquidity
3. Removes the borrowed liquidity from the Uniswap V3 position and sends the resulting tokens to the borrower
4. Records the loan with a start timestamp and pre-deposited interest reserve

Active loans can be modified with `adjust()` (change borrow size or collateral) or closed with `close()`. At close, the borrower repays the borrowed liquidity, the actual accrued interest is deducted from the interest reserve, any unused reserve is returned to the borrower, and the collateral is released.

### Collateral Requirement
A borrower deposits exactly one token type as collateral — either tokenA or tokenB. The protocol enforces that only one type is accepted per loan.
                                                                                                
The solvency check compares the collateral against the value of the borrowed CLP expressed in the collateral token. The check evaluates the CLP at its worst-case price — the price at which the borrowed position has its maximum possible value in the collateral token. This means the collateral requirement is always conservative: if it holds at the worst-case price, the position is solvent at any price within the range. 

This check is enforced by checkRequirement() on every open() and adjust() before any funds are released. Because the worst-case price is derived from the fixed tick boundaries rather than the live spot price, no oracle is needed and the requirement cannot be     
gamed by moving the pool price.
                                                                                                  
The collateral includes a margin (equal to the opening fee percentage). This margin is not returned to the borrower — it is paid to whoever closes the loan once the interest reserve is exhausted, incentivizing third parties to close expired positions. The same fee variable is reused for the margin to avoid a redundant storage variable.

### Interest Model
Interest accrues linearly over time at an annualized rate derived from the pool fee:

```
Opening fee  = borrowedAmount × poolFee / 1e6
Annual rate  = poolFee × multiplier / 1e6
Accrued      = annualRate × (currentTime − startTime) / 31,536,000
```

The interest reserve deposited at open determines the maximum loan duration. Borrowers can top up their reserve with `setInterest()` to extend their loan. At close, only the accrued portion is kept by the protocol (distributed to lenders); the remainder is refunded.

### Fee Distribution
All borrower interest payments accumulate into the tick's `feeGrowth` accumulators. Lenders collect their share through the same mechanism as Uniswap V3 LP fee collection — proportional to their liquidity contribution relative to the tick total.

```
Lender yield = AMM swap fees + borrower interest = feeGrowthDelta × lenderLiquidity
```

---

## Security Properties

- **No admin keys / no upgrades**: All pools are immutable once deployed
- **Permissionless pool creation**: Any token pair with a Uniswap V3 pool can be supported
- **Callback validation**: `Connector` derives pool addresses via CREATE2 and rejects callbacks from unverified senders
- **Solvency checks**: Every borrow and adjustment verifies collateral sufficiency before state changes
- **Block-based locking**: Prevents same-block liquidity manipulation

---

## Testing and Verification

| Layer | Tool | Coverage |
|-------|------|---------|
| Unit tests | Hardhat (JavaScript + Ethers.js) | Core lending/borrowing logic |
| Fuzz tests | Forge (`Kommodo_fuzz.t.sol`) | Property-based testing against forked local node |
| Formal verification | Halmos (`Kommodo_formal.sol`) | Invariant checking with mock pools |

---