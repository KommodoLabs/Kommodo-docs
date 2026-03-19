---
sidebar_position: 4
---

# Fees
The kommodo protocol is build on top of Uniswap v3. It therefore uses the uniswap fee structure. 

## Multiplier
Since loans are higher risk than a swap the protocol introduces a multiplier at wich the underlying uniswapv3 pool fee is multiplied. The multiplier is set at the `KommodoFactory` and applied in every kommodo pool deployed from that factory. 

## Start fee
The start fee is equal to the underlying `uniswap v3 fee (no multiplier)`. The fee is calculated based on the amount of collateral and payed in the collateral asset at the start of the loan. The fee is based on the collateral amount since the CLP value (borrowed) changes based on the current price and therefore can be influenced. 

## Interest
The start yearly interest is equal to the underlying `uniswap v3 fee * multiplier`. The interest is based on the amount of collateral and payed in the collateral asset. The interest is based on the collateral amount since the CLP value (borrowed) changes based on the current price and therefore can be influenced. 

A loan is "alive" as long as there is unused interest available. As time progresses the borrowers interest is consumed and when no more interest is available the loan is locked. As long as the loan is unlocked the borrower can adjust the interest deposit. After a loan is locked anyone can close is by depositing the borrowed value (CLP) and receiving the collateral, this can be done with a flash loan. 

## Margin
The kommodo protocol solvency check requires a margin equal to the underlying `uniswap v3 fee (no multiplier)`. The margin is part of the collateral deposit. On closing the loan the collateral including margin is send to the user that closed the loan. The margin is not required for the solvency guarantee it is an incentive for other users to close locked loans.

## Swap fees
In addition to the Kommodo protocol fees lenders can earn swap fees from uniswap v3 CLPs that are not actively borrowed an are withing the current price range.




