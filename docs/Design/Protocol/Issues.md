---
sidebar_position: 5
---

# Token Integration Issues
The kommodo protocol is designed for standard ERC20 token implementations. The token integration issues are also applicable to the underlying uniswap v3 protocol.

## Fee-on-transfer tokens
Fee-on-transfer tokens do not function with the kommodo protocol. The contracts check balance changes and fail if these do not match the transfer amounts.

## Rebasing tokens
Loans with a rebasing collateral token can become insolvent if the rebasing is negative. There is no check possible to guarantee solvency with rebasing tokens.

## Blacklisting tokens
Tokens with a blacklist function can permanantly lock funds inside the protcol.

