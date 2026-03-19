---
sidebar_position: 1
---

# Security

| Layer | Tool | Coverage |
|-------|------|---------|
| Unit tests | Hardhat (JavaScript + Ethers.js) | Core lending/borrowing logic |
| Fuzz tests | Forge (`Kommodo_fuzz.t.sol`) | Property-based testing against forked local node |
| Formal verification | Halmos (`Kommodo_formal.sol`) | Invariant checking with mock pools |
| AI analyses | claude code & chatgtp | LLM based repository analyses |
