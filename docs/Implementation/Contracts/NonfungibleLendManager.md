---
sidebar_position: 5
---

# NonfungibleLendManager

**Source:** `contracts/NonfungibleLendManager.sol`\
**Interface:** `contracts/interfaces/INonfungibleLendManager.sol`\
**License:** GPL-3.0-or-later

## Overview

`NonfungibleLendManager` is a periphery contract that wraps `Kommodo` lending positions as ERC-721 NFTs (token name: `"Kommodo Lender Position"`, symbol: `"KLP"`). Each token represents a lender's share of a specific tick in a specific `Kommodo` pool.

The contract acts as the on-chain lender for all positions it manages — it holds the `Kommodo` liquidity on behalf of token owners, tracks each position's fee growth independently, and stages withdrawable balances per token. Ownership or approval of the NFT grants full control over the associated position.

Inherits from OpenZeppelin `ERC721Enumerable`, enabling on-chain enumeration of all positions held by an address.

## Constructor

```solidity
constructor(address _factory)
```

Initializes the ERC-721 with name `"Kommodo Lender Position"` and symbol `"KLP"`. Stores the `KommodoFactory` address.

| Parameter | Type | Description |
|---|---|---|
| `_factory` | `address` | Address of the deployed `KommodoFactory`. |

**Reverts:** `"constructor: zero factory"`

## Modifier

### `isAuthorizedForToken`

```solidity
modifier isAuthorizedForToken(uint256 tokenId)
```

Reverts with `"Not approved"` if `msg.sender` is neither the owner nor an approved operator of `tokenId`. Applied to `take`, `withdraw`, and `burn`.

## State

| Variable | Type | Description |
|---|---|---|
| `factory` | `IKommodoFactory` | Reference to `KommodoFactory`, used to resolve pool addresses and deploy new pools. |
| `nextId` | `uint256` | Auto-incrementing token ID counter, starting at `1`. |
| `position` | `mapping(uint256 => Position)` | Per-token position state. |

## Data Structures

### `Position`

Stores the full state of an NFT-backed lend position.

| Field | Type | Description |
|---|---|---|
| `pool` | `address` | Address of the `Kommodo` pool this position belongs to. |
| `tickLower` | `int24` | Lower tick of the position. The position spans `[tickLower, tickLower + tickSpacing]`. |
| `locked` | `uint128` | Liquidity locked for the remainder of the current block (flash protection). |
| `liquidity` | `uint128` | Current liquidity units held by this token. |
| `blocknumber` | `uint256` | Block number of the last `mint` or `provide` call. |
| `feeGrowth0X128` | `uint256` | Fee growth checkpoint for tokenA at last interaction (Q128). |
| `feeGrowth1X128` | `uint256` | Fee growth checkpoint for tokenB at last interaction (Q128). |
| `withdrawA` | `uint128` | Pending tokenA balance available to withdraw. |
| `withdrawB` | `uint128` | Pending tokenB balance available to withdraw. |

## Functions

### `deploy`

```solidity
function deploy(address token0, address token1, uint24 poolFee) public
```

Convenience function that calls `KommodoFactory.createKommodo` to deploy a new `Kommodo` pool and immediately approves it via `poolApprove`. Use this when interacting with a pair that does not yet have a deployed pool.

| Parameter | Type | Description |
|---|---|---|
| `token0` | `address` | token0 of the pair to deploy. |
| `token1` | `address` | token1 of the pair to deploy. |
| `poolFee` | `uint24` | Fee tier of the Uniswap V3 pool. |

---

### `poolApprove`

```solidity
function poolApprove(address tokenA, address tokenB, uint24 poolFee) public
```

Grants the `Kommodo` pool contract unlimited ERC-20 approval for both `tokenA` and `tokenB` from the `NonfungibleLendManager`. Must be called before `mint` or `provide` if approval has not been set. Resets the allowance to `0` before setting to `type(uint256).max` to support non-standard ERC-20 tokens.

| Parameter | Type | Description |
|---|---|---|
| `tokenA` | `address` | token0 of the pool to approve. |
| `tokenB` | `address` | token1 of the pool to approve. |
| `poolFee` | `uint24` | Fee tier used to resolve the pool address. |

---

### `mint`

```solidity
function mint(MintParams calldata params) public
```

Creates a new lend position NFT. Pulls up to `amountMaxA` and `amountMaxB` from the caller, deposits liquidity into the target `Kommodo` pool, mints an NFT to the caller, and refunds any unused tokens.

| Parameter | Type | Description |
|---|---|---|
| `params.assetA` | `address` | tokenA of the pool. |
| `params.assetB` | `address` | tokenB of the pool. |
| `params.poolFee` | `uint24` | Fee tier of the pool. |
| `params.tickLower` | `int24` | Lower tick of the position. |
| `params.liquidity` | `uint128` | Liquidity units to deposit. |
| `params.amountMaxA` | `uint128` | Maximum tokenA to spend (slippage protection). |
| `params.amountMaxB` | `uint128` | Maximum tokenB to spend (slippage protection). |

The minted NFT's `position` is initialized with the liquidity delta, current fee growth checkpoints, and block number from the `Kommodo` lender state.

---

### `provide`

```solidity
function provide(ProvideParams calldata params) public
```

Adds liquidity to an existing NFT position. Any caller may provide liquidity to any token ID — ownership is not required. Pulls up to `amountMaxA` / `amountMaxB` from the caller, deposits liquidity into the `Kommodo` pool, updates the position's fee growth checkpoints (harvesting accrued fees into `withdrawA` / `withdrawB`), and refunds unused tokens.

| Parameter | Type | Description |
|---|---|---|
| `params.tokenId` | `uint256` | ID of the position to add liquidity to. Must be non-zero. |
| `params.assetA` | `address` | tokenA of the pool (used for transfers). |
| `params.assetB` | `address` | tokenB of the pool (used for transfers). |
| `params.liquidity` | `uint128` | Liquidity units to add. |
| `params.amountMaxA` | `uint128` | Maximum tokenA to spend (slippage protection). |
| `params.amountMaxB` | `uint128` | Maximum tokenB to spend (slippage protection). |

Liquidity added in the current block is recorded in `locked` to enforce same-block flash protection.

**Reverts:** `"provide: invalid Id"`

---

### `take`

```solidity
function take(TakeParams calldata params) public isAuthorizedForToken(params.tokenId)
```

Removes liquidity from an NFT position and immediately transfers all pending balances (removed liquidity + accrued fees) to `recipient`. Only unlocked liquidity may be removed.

| Parameter | Type | Description |
|---|---|---|
| `params.tokenId` | `uint256` | ID of the position. |
| `params.liquidity` | `uint128` | Liquidity units to remove. |
| `params.amountMinA` | `uint128` | Minimum tokenA to receive (slippage protection). |
| `params.amountMinB` | `uint128` | Minimum tokenB to receive (slippage protection). |
| `params.recipient` | `address` | Address to receive the withdrawn tokens. |

Fee growth is harvested into `withdrawA` / `withdrawB` before the liquidity removal. After `take`, `withdraw` is called internally with `type(uint128).max` to flush the full pending balance.

**Reverts:** `"take: liquidity locked"`

---

### `withdraw`

```solidity
function withdraw(WithdrawParams memory params) public isAuthorizedForToken(params.tokenId)
```

Transfers pending token balances from the position to `recipient`. If the position still holds liquidity, fee growth is first harvested from the `Kommodo` pool to update `withdrawA` / `withdrawB`. Partial withdrawals are supported — amounts are capped to the available balance.

| Parameter | Type | Description |
|---|---|---|
| `params.tokenId` | `uint256` | ID of the position. |
| `params.amountA` | `uint128` | Maximum tokenA to withdraw. |
| `params.amountB` | `uint128` | Maximum tokenB to withdraw. |
| `params.recipient` | `address` | Address to receive the tokens. |

**Reverts:** `"withdraw: zero recipient"`

---

### `burn`

```solidity
function burn(uint256 tokenId) public isAuthorizedForToken(tokenId)
```

Destroys the NFT and deletes the `position` entry. The position must be fully empty before burning: `liquidity == 0`, `withdrawA == 0`, and `withdrawB == 0`.

| Parameter | Type | Description |
|---|---|---|
| `tokenId` | `uint256` | ID of the token to burn. |

**Reverts:** `"burn: no position"`, `"burn: not empty"`

## Fee Accounting

The `NonfungibleLendManager` maintains its own per-token fee growth checkpoints independently from `Kommodo`'s per-address lender state. On every `provide`, `take`, or `withdraw` call the contract computes the delta between the pool's current `feeGrowth0X128` / `feeGrowth1X128` and the position's last checkpoint, then credits the proportional share to `position.withdrawA` / `position.withdrawB`:

```
owed = mulDiv(feeGrowthDelta, position.liquidity, Q128)
```

This allows multiple NFT positions to share the same `Kommodo` lender slot while each tracking its own accrued yield.

## Integration Notes

- **Approval before use:** Call `poolApprove` once per pool before the first `mint` or `provide`. Without it, token transfers to `Kommodo` will fail.
- **Pool deployment:** Use `deploy` to create and approve a pool in a single transaction if it does not exist yet.
- **Any caller can provide:** `provide` has no ownership check. Liquidity can be added to any token ID by any address.
- **Flash protection:** Liquidity deposited in a given block via `mint` or `provide` is locked until the next block and cannot be removed by `take` in the same transaction.
- **Burning:** A token cannot be burned until all liquidity has been removed via `take` and all pending balances have been withdrawn via `withdraw`.
- **Off-chain enumeration:** Use the inherited `ERC721Enumerable` functions (`tokenOfOwnerByIndex`, `totalSupply`) to enumerate positions held by an address.
