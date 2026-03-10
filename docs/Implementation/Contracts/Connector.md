---
sidebar_position: 4
---

# Connector

An abstract contract that provides the Uniswap V3 integration layer. All calls that mint, burn, or collect liquidity from Uniswap V3 go through `Connector`. It handles the `uniswapV3MintCallback` required by the V3 pool during liquidity provisioning and validates callbacks via deterministic pool address derivation (CREATE2).