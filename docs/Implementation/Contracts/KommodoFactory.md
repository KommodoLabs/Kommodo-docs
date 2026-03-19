---
sidebar_position: 2
---

# KommodoFactory

**Source:** `contracts/KommodoFactory.sol`\
**Interface:** `contracts/interfaces/IKommodoFactory.sol`\
**License:** GPL-3.0-or-later

## Overview

`KommodoFactory` is the entry point for deploying `Kommodo` lending pools. It maintains a registry of all deployed pools and enforces uniqueness, only one `Kommodo` instance can exist per `(tokenA, tokenB, poolFee)`. Each pool maps to a corresponding Uniswap V3 pool. It is intentionally minimal: no access control, no upgradability, no fee governance. Any address may call `createKommodo`.

## Constructor

```solidity
constructor(address _factory, uint24 _multiplier)
```

| Parameter | Type | Description |
|---|---|---|
| `_factory` | `address` | Uniswap V3 factory used to validate `poolFee` values and derive `tickSpacing`. |
| `_multiplier` | `uint24` | Fee multiplier forwarded to every deployed `Kommodo`. Must be non-zero. |

Both parameters are immutable after deployment.

## State

| Variable | Type | Description |
|---|---|---|
| `factory` | `address` | Uniswap V3 factory address. |
| `multiplier` | `uint24` | Interest multiplier applied to all pools. |
| `kommodo` | `mapping(...)` | Lookup table: `(assetA, assetB, poolFee) → Kommodo address`. |
| `allKommodo` | `address[]` | Append-only list of all deployed `Kommodo` addresses. |

## Functions

### `createKommodo`

```solidity
function createKommodo(address assetA, address assetB, uint24 poolFee)
    public returns (address)
```

Deploys a new `Kommodo` lending pool for the given token pair and Uniswap V3 fee tier.

**Reverts:**

| Reason | Condition |
|---|---|
| `"create: identical assets"` | Both token addresses are the same. |
| `"create: no address zero"` | The lower-sorted token address is `address(0)`. |
| `"create: existing pool"` | A `Kommodo` for this pair and fee already exists. |
| `"constructor: invalid poolFee"` | The fee tier is not supported by the Uniswap V3 factory. |

### `allKommodoLength`

```solidity
function allKommodoLength() external view returns (uint)
```

Returns the total number of deployed `Kommodo` pools. Useful for enumerating all pools via `allKommodo[i]`.

### `kommodo` (mapping lookup)

```solidity
kommodo[assetA][assetB][poolFee] → address
```

Returns the `Kommodo` address for a given pair and fee tier, or `address(0)` if none exists. Token order does not matter — both orderings resolve to the same pool.

## Integration Notes

- **Pool discovery:** Use `allKommodoLength()` + `allKommodo[i]` to enumerate all pools, or query `kommodo[tokenA][tokenB][fee]` directly if the pair is known.
- **Fee tiers:** `poolFee` must be a valid Uniswap V3 fee tier (e.g., `500`, `3000`, `10000`). The factory will revert on unrecognized values.
- **No duplicate pools:** Calling `createKommodo` for an existing pair/fee will revert. Always check `kommodo[a][b][fee] != address(0)` before attempting creation.
- **Token ordering:** You do not need to pre-sort tokens before calling `createKommodo` or querying the mapping. The contract handles canonical ordering internally.
