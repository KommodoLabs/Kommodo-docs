---
sidebar_position: 5
---

# AI analyses

**Directory:** `test_other/audit_check/`

Two AI-assisted security reviews were conducted on the Kommodo protocol in March 2026. Their methodologies are described below.

---

## Report 1 — ChatGPT Manual Review

**File:** `chatgtp_05032026.md`\
**Tool:** ChatGPT\
**Date:** March 2026\
**Scope:** `KommodoFactory.sol`, `Kommodo.sol`, `Connector.sol`

### Methodology

The review was conducted as a manual security analysis by the model, examining the contracts line by line across five focused areas:

- **Access control** — whether privileged operations are appropriately restricted.
- **Pool deployment guarantees** — correctness of factory logic, token ordering, uniqueness enforcement, and fee tier validation.
- **Arithmetic safety** — verification that all arithmetic operations are protected against overflow and underflow.
- **External dependency risks** — trust assumptions around Uniswap V3 and ERC-20 token behavior.
- **Invariant correctness** — whether protocol-level invariants (e.g. locked ≤ liquidity) hold under all code paths.

The model was provided the full source of the three in-scope contracts and asked to reason about potential vulnerabilities, incorrect assumptions, and design flaws. Findings were assessed against architectural context supplied by the protocol team, including deployment ordering, Solidity version guarantees, and borrower responsibility for interest management.

---

## Report 2 — Claude Code (Pashov AI Auditor)

**File:** `claudecode-pashov-ai-audit-report-20260306.md`\
**Tool:** Claude Code with the Pashov AI Auditor skill\
**Date:** 2026-03-06\
**Scope:** `Kommodo.sol`, `Connector.sol`, `NonfungibleLendManager.sol`, `KommodoFactory.sol`, and all libraries under `contracts/libraries/`\
**Confidence threshold:** 80

### Methodology

The review was run using the Pashov AI Auditor skill inside Claude Code, which applies a structured multi-agent audit methodology to the full contract scope. The process consists of two phases:

**Phase 1 — Vector Scan**\
A dedicated Vector Scan Agent systematically checks the codebase against a curated library of known Solidity attack vectors. Each vector is evaluated against the code and assigned a confidence score. Only findings at or above the configured threshold (80) are surfaced.

**Phase 2 — Adversarial Reasoning**\
An Adversarial Reasoning Agent takes the surfaced candidates and attempts to construct concrete exploit scenarios. It reasons about preconditions, attacker-controlled inputs, execution order, and economic impact to determine whether a theoretical weakness is practically exploitable and to propose a targeted fix.

The combination of systematic pattern matching in Phase 1 and goal-directed exploit reasoning in Phase 2 is designed to reduce both false positives and false negatives compared to single-pass analysis.
