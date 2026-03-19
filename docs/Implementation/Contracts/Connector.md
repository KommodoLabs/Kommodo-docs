---
sidebar_position: 4
---

# Connector

**Source:** `contracts/Connector.sol`\
**License:** GPL-3.0-or-later

## Overview

`Connector` is an abstract base contract that encapsulates all direct interactions with a Uniswap V3 pool. It is inherited by `Kommodo` and handles minting, burning, and collecting liquidity positions, as well as fulfilling the `IUniswapV3MintCallback` required by the Uniswap V3 mint flow and validates callbacks via deterministic pool address derivation (CREATE2).

`Connector` is stateless beyond the `factory` address and is not deployed independently.

## State

| Variable | Type | Description |
|---|---|---|
| `factory` | `address` | Uniswap V3 factory address. |

## Data Structures

### `MintCallbackData`

```solidity
struct MintCallbackData {
    PoolAddress.PoolKey poolKey;
    address payer;
}
```

Encoded as the `data` payload passed to `pool.mint` and decoded inside `uniswapV3MintCallback`. `poolKey` is used to validate the callback origin; `payer` is the address from which tokens are pulled.

## Functions

### `Initialize`

Sets the `factory` address. Can only be called once — reverts if `factory` is already set. Called by the `Kommodo` constructor immediately after deployment.

| Parameter | Type | Description |
|---|---|---|
| `_factory` | `address` | Uniswap V3 factory address to store. |

**Reverts:** `"Connector: false factory"`, `"Connector: factory already initialized"`

### `uniswapV3MintCallback`

```solidity
function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external override
```

Implements `IUniswapV3MintCallback`. Called by the Uniswap V3 pool during `pool.mint` to pull tokens from the payer. Decodes the `MintCallbackData` embedded in `data`, validates the caller is a legitimate pool via `CallbackValidation.verifyCallback`, then transfers the owed amounts from `payer` to the pool.

| Parameter | Type | Description |
|---|---|---|
| `amount0Owed` | `uint256` | Amount of `token0` owed to the pool. |
| `amount1Owed` | `uint256` | Amount of `token1` owed to the pool. |
| `data` | `bytes` | ABI-encoded `MintCallbackData` containing the pool key and payer address. |

### `addLiquidity` (amount-based)

```solidity
function addLiquidity(
    address tokenA, address tokenB, uint24 poolFee,
    int24 tickLower, int24 tickUpper,
    uint128 amountA, uint128 amountB
) internal returns (uint128 liquidity, uint256 amount0, uint256 amount1, IUniswapV3Pool pool)
```

Converts token amounts to a liquidity value using `LiquidityAmounts.getLiquidityForAmounts` at the pool's current `sqrtPriceX96`, then mints that liquidity into the position `[tickLower, tickUpper]`. Token transfers are fulfilled via `uniswapV3MintCallback`.

| Parameter | Type | Description |
|---|---|---|
| `tokenA` | `address` | token0 of the pool. |
| `tokenB` | `address` | token1 of the pool. |
| `poolFee` | `uint24` | Fee tier used to resolve the pool address. |
| `tickLower` | `int24` | Lower tick of the position. |
| `tickUpper` | `int24` | Upper tick of the position. |
| `amountA` | `uint128` | Desired token0 amount, used to compute liquidity. |
| `amountB` | `uint128` | Desired token1 amount, used to compute liquidity. |

**Returns:** `liquidity` — units minted; `amount0` / `amount1` — tokens actually consumed; `pool` — the resolved pool instance.

### `addLiquidity` (liquidity-based)

```solidity
function addLiquidity(
    address tokenA, address tokenB, uint24 poolFee,
    int24 tickLower, int24 tickUpper,
    uint128 amount
) internal returns (uint128 liquidity, uint256 amount0, uint256 amount1, IUniswapV3Pool pool)
```

Mints an exact `amount` of liquidity units directly into the position `[tickLower, tickUpper]`, bypassing the amount-to-liquidity conversion. Used when repaying a loan with a known liquidity quantity.

| Parameter | Type | Description |
|---|---|---|
| `tokenA` | `address` | token0 of the pool. |
| `tokenB` | `address` | token1 of the pool. |
| `poolFee` | `uint24` | Fee tier used to resolve the pool address. |
| `tickLower` | `int24` | Lower tick of the position. |
| `tickUpper` | `int24` | Upper tick of the position. |
| `amount` | `uint128` | Exact liquidity units to mint. |

**Returns:** `liquidity` — mirrors `amount`; `amount0` / `amount1` — tokens consumed; `pool` — the resolved pool instance.

### `removeLiquidity`

```solidity
function removeLiquidity(
    address tokenA, address tokenB, uint24 poolFee,
    int24 tickLower, int24 tickUpper,
    uint128 liquidity
) internal returns (uint256 amount0, uint256 amount1, IUniswapV3Pool pool)
```

Calls `pool.burn` to remove `liquidity` from the position `[tickLower, tickUpper]`. Returns the token amounts staged for collection. Tokens are not transferred to any address until `collectLiquidity` is called.

| Parameter | Type | Description |
|---|---|---|
| `tokenA` | `address` | token0 of the pool. |
| `tokenB` | `address` | token1 of the pool. |
| `poolFee` | `uint24` | Fee tier used to resolve the pool address. |
| `tickLower` | `int24` | Lower tick of the position. |
| `tickUpper` | `int24` | Upper tick of the position. |
| `liquidity` | `uint128` | Liquidity units to remove. Pass `0` to trigger a fee update without removing liquidity. |

**Returns:** `amount0` / `amount1` — token amounts available for collection; `pool` — the resolved pool instance.

### `collectLiquidity`

```solidity
function collectLiquidity(
    address tokenA, address tokenB, address receiver, uint24 poolFee,
    int24 tickLower, int24 tickUpper,
    uint128 amountA, uint128 amountB
) internal returns (uint256 amount0, uint256 amount1, IUniswapV3Pool pool)
```

Calls `pool.collect` to transfer up to `amountA` of `token0` and `amountB` of `token1` from the pool's owed balance to `receiver`. Used after `removeLiquidity` to finalize token withdrawals and to harvest accrued swap fees.

| Parameter | Type | Description |
|---|---|---|
| `tokenA` | `address` | token0 of the pool. |
| `tokenB` | `address` | token1 of the pool. |
| `receiver` | `address` | Address to receive the collected tokens. |
| `poolFee` | `uint24` | Fee tier used to resolve the pool address. |
| `tickLower` | `int24` | Lower tick of the position. |
| `tickUpper` | `int24` | Upper tick of the position. |
| `amountA` | `uint128` | Maximum token0 to collect. |
| `amountB` | `uint128` | Maximum token1 to collect. |

**Returns:** `amount0` / `amount1` — tokens actually transferred; `pool` — the resolved pool instance.

### `tokensOwed`

```solidity
function tokensOwed(
    address tokenA, address tokenB, uint24 poolFee,
    int24 tickLower, int24 tickUpper
) public view returns (uint128 tokensOwed0, uint128 tokensOwed1)
```

Reads the uncollected fee amounts owed to the `Kommodo` contract for a given position directly from `pool.positions`. Used by `Kommodo.updateFeeGrowth` to determine how much to harvest before updating fee growth accumulators.

| Parameter | Type | Description |
|---|---|---|
| `tokenA` | `address` | token0 of the pool. |
| `tokenB` | `address` | token1 of the pool. |
| `poolFee` | `uint24` | Fee tier used to resolve the pool address. |
| `tickLower` | `int24` | Lower tick of the position. |
| `tickUpper` | `int24` | Upper tick of the position. |

**Returns:** `tokensOwed0` / `tokensOwed1` — uncollected token amounts owed to the position.

## Integration Notes

- **Pool address derivation:** Pool addresses are always computed deterministically via `PoolAddress.computeAddress`.
- **Two-step withdrawal:** Removing liquidity requires both `removeLiquidity` (burns position, stages tokens) and `collectLiquidity` (transfers tokens). `Kommodo` always calls both in sequence.
- **Callback security:** `uniswapV3MintCallback` validates the caller against the factory before transferring any tokens. It will revert on any call not originating from a legitimate Uniswap V3 pool.
