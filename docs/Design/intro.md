---
sidebar_position: 1
---

# Design

## Intro
Kommodo is a protocol for lending and borrowing cryptocurrencies (ERC20 Tokens) on the Ethereum blockchain. Loans are denomiated in CLP positions that allow auto adjusting based on the "current" market price of the AMM. 

## How
The protocol is an extension of uniswap v3 to inherit its decentralized properties. 

### Concentraded Liquidity Positions
Uniswap v3 introduces Concentraded Liquidity Positions (CLPs) that allows providers to provide liquidity between two price points. 

Simplified the CLP can be seen as the opposite party of any trade. Shown by the fact that when the price (tokenB / tokenA) of tokenA rises a trader buys tokenA and deposits tokenB, decreasing the available tokenA in the pool (owned by the CLP). When the price of tokenA rises above the CLP range all of the CLP will be tokenB and when the price drops below the range all the CLP will be tokenA. Acting as the taker of a trade.

### Solvency guarantee
The fact that a CLP is the opposite party allows for kommodo to guarantee solvency on loans of CLP positions. 
