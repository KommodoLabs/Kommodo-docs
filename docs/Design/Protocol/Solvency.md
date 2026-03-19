---
sidebar_position: 3
---

# Solvency guarantee
The solvency guarantee at the start of the loan is fundemental to the design of the kommodo lending protocol. The guarantee emerges from the use of CLPs to denominate loan positions. A CLP consists of a token pair, lets call these `tokenA` and `tokenB` and express the price as `tokenB/tokenA`. 

| Price  | Value type |
| ------------- | ------------- | 
| `current price <= CLP lower bound`   | tokenA |
| `current price > CLP lower bound & current price < higher bound` | tokenA & tokenB ratio|
| `current price >= CLP higher bound`  | tokenB |

## Upper bound
The CLP sets an upper bound (price) for `tokenA` in relation to `tokenB`. If the price of `tokenA` increases above this bound the CLP converts to `tokenB` essentialy capping the value. Inside the range the CLP start swapping `tokenA` for `tokenB` at prices lower than the upper bound. The upper bound therefore guarantees the maximum value of `tokenA` in relation to `tokenB`. Notice that `tokenA` and `tokenB` can be switched to hold the same guarantee from that perspective.

When depositing `tokenA` the kommodo protocol checks `amount tokenA collateral == value tokenA CLP`. Since the CLP value is capped at amount `tokenA` this check guarantees solvency for the lifetime of the loan.

## Example
*Borrow CLP @ price 3000 USDC/ETH (current price is 2000 USDC/ETH) by depositing 3000 USDC (collateral). The price is above the current price so the CLP returns 1 ETH (3000 USDC / 3000 CLP price). Now the price of ETH rises to 4000 USDC/ETH. Your collateral of 3000 USDC would normally be insufficient for the value of your borrowed 1 ETH. However the CLP price is now below the current price so the value is denominated in 3000 USDC. Where your collateral 3000 USDC is equal to the borrowed CLP value of 3000 USDC.*














