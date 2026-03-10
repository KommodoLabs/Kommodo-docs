---
sidebar_position: 1
---

# Overview
Kommodo is a permissionless, on-chain lending protocol built on Ethereum that integrates directly with Uniswap V3 liquidity pools. It enables lenders to earn yield on their assets by supplying liquidity at specific price ticks, and allows borrowers to take collateralized loans against that liquidity. 

The protocolis permissionless — any token pair with an existing Uniswap V3 pool can immediately be used as a lending market.

---

## Architecture

The system is composed of four core contracts:

```
KommodoFactory
    └── deploys → Kommodo (one per token pair + fee tier)
                      └── extends → Connector (Uniswap V3 integration)

NonfungibleLendManager
    └── wraps → Kommodo (ERC721 position tracking for lenders)
```
---

## Stack

| Component | Technology |
|-----------|-----------|
| Smart contracts | Solidity 0.8.24 |
| AMM integration | Uniswap V3 (v3-core, v3-periphery) |
| Token standards | ERC20, ERC721 (OpenZeppelin Enumerable) |
| Build & unit tests | Hardhat 2.17.3, Ethers.js, Waffle |
| Fuzz & formal tests | Foundry (Forge), Halmos |
| Math libraries | FullMath, LiquidityAmounts, TickMath, SqrtPriceMath, SafeCast |
| Deployment target | Ethereum (Sepolia testnet, EVM-compatible chains) |

---

## Contract Interfaces
- `IKommodo` — core pool interface (provide, take, open, close, adjust, checkRequirement)
- `IKommodoFactory` — factory interface (createKommodo, pool lookup)
- `INonfungibleLendManager` — NFT position manager interface (mint, provide, take, withdraw, burn)
- Uniswap V3 interfaces — `IUniswapV3Pool`, `IUniswapV3Factory`, `IUniswapV3MintCallback`
