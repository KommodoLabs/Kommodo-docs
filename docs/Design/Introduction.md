---
sidebar_position: 1
---

# Design

## Introduction
Kommodo is a protocol for lending and borrowing cryptocurrencies (ERC20 Tokens) on the Ethereum blockchain, loans are denomiated in Concentraded Liquidity Positions (CLPs) that allow auto adjusting based on the "current" market price of the AMM. The protocol is implemented as a set of persistent (non-upgradable) smart contracts; designed to prioritize censorship resistance, security, self-custody and to function without any trusted intermediaries who may selectively restrict access.

## Collateral
Most blockchain lending protocols are secured by collateral, the digital assets a borrower locks in the protocol to secure a loan. Unlike traditional finance, which relies on credit scores, these protocols uses over-collateralization. This requires borrowers to supply assets of greater value than the amount they borrow. In a trustless system over-collateralization is essential.

## Lending and Borrowing
Like other onchain lending protocols Kommodo functions as a two-sided market. Users can participate as lenders (suppliers), borrowers, or both.

| Role  | Action | Fee |
| ------------- | ------------- | ------------- |
| Lender   | Supply assets (CLP) | Earn interest |
| Borrower | Lock collateral and borrow assets (CLP) | Pay interest |

## Comparison
Collateralized lending requires the protocol to have the price between the collateral asset and the borrow asset in order to determine solvency. The leading method of receiving the price is through an oracle. Because oracles are external sources they introduce risk to the protocol and limit the permissionless nature (only cryptocurrencies with oracles). 

**The kommodo protocol does not need a price feed (oracle)**, the price is directly integrated by using CLPs.
