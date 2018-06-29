Warning this is alpha and will involve additional steps until 0x.js for v2 is published.

As a number of the internal packages are not published for v2 yet, it requires a check out of 0x-monorepo locally.

This project will run against both a local [ganache](https://truffleframework.com/ganache) and the 0x v2 Kovan deployment.

![cli](https://user-images.githubusercontent.com/27389/42074402-6dcc5ccc-7baf-11e8-84f1-9a27f1a96b08.png)

## Getting Started

Clone the 0x-monorepo locally, checkout to the v2-prototype branch, install dependencies and build packages.

```
git clone git@github.com:0xProject/0x-monorepo.git
cd 0x-monorepo
git checkout v2-prototype
yarn install
yarn build
```

Once built, run yarn link in the following directories inside the 0x-monorepo under packages:

```
cd packages
cd types && yarn link && cd ../
cd order-utils && yarn link && cd ../
cd abi-gen && yarn link && cd ../
cd base-contract && yarn link && cd ../
cd web3-wrapper && yarn link && cd ../
```

In this project, install dependencies then link the projects the 0x-monorepo packages from the previous step:

```
yarn install
yarn link "@0xproject/types" "@0xproject/order-utils" "@0xproject/abi-gen" "@0xproject/base-contract" "@0xproject/web3-wrapper"
```

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
node lib/scenarios/fill_order.js
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
