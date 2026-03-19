---
sidebar_position: 2
---

# Users

## Lender

### Provide
Lenders in the kommodo protocol deposit a single asset at a specific tick. The kommodo procotol then deposits these assets in a CLP at the specified tick. The protocol deposits in a small CLP range of tick + spacing to maximaze flexibility in loan prices. When providing liquidity through the `NonfungibleLendManager` the lender receives an NFT linked to the position. 

### Take
Lenders can withdraw the CLP position. Any borrow position at the CLP tick locks the liquidity. If the lenders liquidity exceeds the unborrowed liquidity it can't be fully closed. Through the `NonfungibleLendManager` a lender is possible to tranfer and trade the locked position.

## Borrower

### Open
Borrowers deposit a single assets as collateral and receive a CLP position. On start of the loan the kommodo protocol checks the solvency of the collateral assets against the CLP value. Then the protocol closes the CLP and transfers the single asset to the borrower. In addition to the collateral the borrower deposit interest to keep the loan "alive". 

### Adjust
Borrowers can adjust the loan position during its existence; by deposit of collateral, borrow additional funds or both. Before the adjustment the protocol verifies that the loan is solvent. 

### Close
Borrowers can close the loan during its existence. To close the loan a user has to deposit the assets required by the CLP. The kommodo protocol then reopens the CLP with these assets and returns the collateral assets to the sender. Notice that when the price of the assets has changed the CLP and therefore kommodo require the deposit of a different assets then the original assets that was received when opening the loan. 

As time progresses the borrowers interest is consumed and when no more interest is available the loan is locked. After lock no more adjustments are possible and anyone can close the loan. The account that closes the loan receives the margin deposit as a reward for closing. Since the loan is fully closed no solvency check is performed.