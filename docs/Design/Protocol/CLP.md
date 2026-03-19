---
sidebar_position: 1
---

# Concentraded liquidity positions
In traditional AMMs, liquidity is distributed uniformly from zero to infinity. Uniswap v3 introduced Concentraded Liquidity Positions (CLPs) that allows providers to provide liquidity between two price points. 

CLPs are the AMMS opposite party of any trade. When a trader swaps assets the traders increases the inbound asset in the pool and decreases the outbound asset. Essentially increasing the outbound assets value in relation to the inbound asset. Once the upper bound price point of the CLP is reached it will consist only of the inbound asset, since the traders withdrew all the outbound assets in that range.

# Ticks
To achieve concentrated liquidity, the continuous spectrum of price space has been partitioned with ticks. Ticks are the boundaries between discrete areas in price space. Ticks are spaced such that an increase or decrease of 1 tick represents a 0.01% increase or decrease in price at any point in price space. 

As the spot price changes during swapping, the uniswap v3 pool contract will continuously exchange the outbound asset for the inbound, progressively using all the liquidity available within the current tick interval until the next tick is reached. At this point, the contract switches to a new tick and activates any dormant liquidity within a CLP that has a boundary at the newly active tick.





