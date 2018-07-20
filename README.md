This project will run against both a local [ganache](https://truffleframework.com/ganache) and the 0x v2 Kovan deployment.

![cli](https://user-images.githubusercontent.com/27389/42074402-6dcc5ccc-7baf-11e8-84f1-9a27f1a96b08.png)

## Scenarios

-   Fill Order (ERC20)
-   Fill Order Fees
-   Fill Order (ERC721)
-   Cancel Orders Up To
-   Match Orders
-   Execute Transaction

## Getting Started

Update the mnemonic in `src/constants.ts` or use the one provided (note if many people use this mnemonic on Kovan then the funds may be drained).

Build this package:

```
yarn run build
```

Download and start the ganache instance:

```
yarn run download_snapshot
yarn run ganache-cli
```

Run this example in another terminal:

```
yarn run scenario:fill_order
```

To run all scenarios:

```
yarn run scenario:all
```

### Switching to Kovan

To switch between Kovan/ganache uncomment the appropriate lines in `src/constants.ts` and re-build. Ganache is enabled by default.

For Ganache:

```
// Ganache
export const RPC_URL = GANACHE_RPC;
export const NETWORK_ID = GANACHE_NETWORK_ID;
export const TX_DEFAULTS = GANACHE_TX_DEFAULTS;
```

For Kovan:

```
// Kovan
export const RPC_URL = KOVAN_RPC;
export const NETWORK_ID = KOVAN_NETWORK_ID;
export const TX_DEFAULTS = KOVAN_TX_DEFAULTS;
```
