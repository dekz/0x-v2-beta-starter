Warning this is alpha and will involve additional steps until 0x.js for v2 is published.

As a number of the internal packages are not published for v2 yet, it requires a check out of 0x-monorepo locally.

This project will run against the 0x V2 Kovan deployment.

Steps:

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
```

In this project, install dependencies then link the projects the 0x-monorepo packages from the previous step:

```
yarn install
yarn link "@0xproject/types" "@0xproject/order-utils" "@0xproject/abi-gen" "@0xproject/base-contract"
```

Update the mnemonic in `src/constants.ts` or use the one provided (note if many people use this mnemonic funds may be drained).

Build this package:

```
yarn run build
```

Run this example

```
node lib/scenarios/fill_order.js
```
