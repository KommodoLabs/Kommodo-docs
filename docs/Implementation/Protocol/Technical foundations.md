---
sidebar_position: 1
---

# Technical foundations

## Deployment
Kommodo pools are deployed by the `KommodoFactory` or through `NonfungibleLendManager`. Deployment requires and existing Uniswap v3 Factory and active fee tier. Every deployed Kommodo pool is directly linked to the underlying Uniswap v3 pool based on the token pair and fee tier. Deployment of a Kommodo pool does not require a pre deployed Uniswap v3 pool for that token pair and fee tier. Any interaction with a Kommodo pool where the Uniswap v3 pool is not deployed would fail until the Uniswap v3 pool is deployed.

When deployed using `NonfungibleLendManager` it automatically sets permission for the deployed Kommodo pool to perform token transfer for NonfungibleLendManager. This is required to use `NonfungibleLendManager` to manager lending positions on that pool. 

## Pool setup
On creation of the Kommodo pool all setup steps are performed:
- Uniswap v3 pool variables are stored: token pair/ pool fee / tick spacing.
- Kommodo pool variable interest rate is calculated and stored. The interest rate is calculated based on the immutable factory multiplier and the pool fee.
- Connector variable Uniswap v3 factory address is stored.

## Lender interactions
Lenders can provide liquidity, take liquidity and withdraw assets. These actions can be performed by directly interacting with the Kommodo pool or through the `NonfungibleLendManager` intermediary. Use of the `NonfungibleLendManager` allows for the creation of transferable NFTs linked to the lender positions. 

### Provide liquidity
The user opens or deposits in a lender positions by depositing sufficienttokenA and/or tokenB to open/deposit in the CLP at the requested ticks on the Uniswap V3 pool. Kommodo interacts with Uniswap v3 using the `Connector` to deposit these tokens and receive the CLP. Kommodo groups liquidity for all users based on the tick (in a single CLP position on Uniswap V3) and stores the liquidity amount per lender for that CLP. Lender liquidity deposits are locked for 1 block to remove flash loan interactions by lenders. Any lender deposit therefore can only be taken out the next block.

`NonfungibleLendManager` creates NFTs for lenders positions (not for borrow positions). These NFTs allow lenders with locked liquidity from active borrow positions to trade (exit) the lending position even when active.

### Take liquidity
The user (partially) closes a lender positions by (partially) closing the CLP on the Uniswap V3 pool. Kommodo interacts with Uniswap v3 using the `Connector` to withdraw these tokens and store tokenA and tokenB amounts in the withdraw variables for that position. To withdraw these funds the user then has to call the withdraw function.

As described under provide Kommodo groups lenders per CLP tick where the Kommodo pool is the owner of the CLP. Borrowing (partially) closes this CLP. I a lender takes from a CLP with insufficient liquidity (because of active borrows) the take fales. `NonfungibleLendManager` NFTs allow lenders with locked liquidity from active borrow positions to trade (exit) the lending position even when active. Notice that locked funds is inherent to any lending protocol. Other on chain lending protocols also only allow instant withdraw for unused funds.

### Withdraw assets
Assets from opening fee, interest earned and uniswap V3 swap earning are stored in the withdraw variables of the lender position. The protocl uses withdraw variables to allow fee accumulation in single tokens per position. Funds in the withdraws are not used for lending. 

## Borrower interactions
The user opens or increases the borrow position by depositing collateral. The Kommodo pool checks solvency based on the collateral and the requested liquidity to borrow. If the solvency check succeeds solvency is guarenteed for as long as the loan is active. After a succesfull check Kommodo (partially) closes the CLP postition at the borrow tick using the `Connector` sending the underlying tokens to the borrower.

Notice that the borrower can supply more than the 100% collateral required by the solvency check. Because this is the core logic no check on max collateral is performed. There is no incentive in locking more than required for solvency. In addition to minimize complexity fees are calculated based on supplied collateral amount (not solvency required collateral amount). When a borrower supplies more collateral than is required fees are paid over this overcollaterlized amount.

Besides collateral the borrower has to provide:
- Opening fee: on opening the loan a fixed fee is deposited. This fee equal to the collateral amount times the Uniswap v3 fee. 
- Interest: a borrower deposits interest in a loan. This interest is slowly withdrawn and deposited to the lenders. The yearly interest required is the interest rate (multiplier * fee) times the collateral amount. As long as a loan has sufficient interest its considered active so only the owner can make adjustments. Once the loan has no more interest available the loan is considerd inactive (expired) and anyone can close the loan by depositing the borrowed liquidity and receiving the collateral (including the margin). 
- Margin: on opening of the loan the solvency check requires 100% sufficient collateral + margin. The margin is equal to the collateral amount times the Uniswap v3 fee. This margin is used to incentivize closing the loan.

## Fees, interest and swap fees
The accumulation of fee, interest and swap fees to individual lender positions is calculated using feegrowth. This is the same design as the underlying Uniswap v3 pool. Opening fees and interest is earned when CLPS are used by borrowers. Swap fee is earned when the CLP position is not borrowed (so active in the Uniswap v3 pool) and used for swaps. 

The accumulation of these fees is updated on interactions with Kommodo for that specific tick. Because of this lenders that between updates can receive part of the pending fees. Its not possible to fully remove this risk without compromising the key solvency guaranty. To partially mitigate this risk we lock lenders for 1 block to not allow flash deposits and withdraws. This sufficiently reduces the risk since every active lender economicly has to participate in the pool (they can always be used for borrows for that one block). In addition anyone can call update on the interest used for borrow positions.