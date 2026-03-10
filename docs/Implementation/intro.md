---
sidebar_position: 1
---

# Implementation

## Intro
Kommodo is an automated liquidity protocol for matching suppliers and borrowers. The protocol is designed to prioritize censorship resistance, security, self-custody, no trusted intermediaries.

### Solvency guarantee
The solvency guarentee is fundamental to the design of the lending protocol. 

Uniswap V3 AMM CLPs have the following properties:

| Type  | CLP value |
| ------------- | ------------- |
| `current price <= price lower CLP`    | token0 |
| `current price > price lower CLP && current price < price higher CLP` | token0 && token1 ratio |                                          
| `current price > price higher CLP   ` | token1 | 



