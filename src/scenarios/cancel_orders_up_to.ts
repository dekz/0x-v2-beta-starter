// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetDataUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xproject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NULL_ADDRESS, TX_DEFAULTS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import {
    erc20ProxyAddress,
    etherTokenContract,
    exchangeContract,
    mnemonicWallet,
    providerEngine,
    zrxTokenContract,
    web3Wrapper,
} from '../contracts';
import {
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    printData,
    printScenario,
    printTransaction,
    awaitTransactionMinedSpinnerAsync,
    printOrderInfos,
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario() {
    // In this scenario, the maker creates and signs many orders for selling ZRX for WETH.
    // The maker is able to cancel all of these orders effeciently by using cancelOrdersUpTo
    printScenario('Cancel Orders Up To');
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const maker = accounts[0];
    const taker = accounts[1];
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(100);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenContract.address);

    // Set up the Order and fill it
    const oneMinute = 60 * 1000;
    const tenMinutes = 10 * oneMinute;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);

    // Rather than using a random salt, we use an incrementing salt value.
    // When combined with cancelOrdersUpTo, all lesser values of salt can be cancelled
    // This allows the maker to cancel many orders with one on-chain transaction

    // Create the order
    const order1 = {
        exchangeAddress: exchangeContract.address,
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: randomExpiration,
        salt: new BigNumber(Date.now() - tenMinutes),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFee: ZERO,
        takerFee: ZERO,
    } as Order;

    const order2 = {
        ...order1,
        salt: new BigNumber(Date.now() - oneMinute),
    } as Order;

    const order3 = {
        ...order1,
        salt: new BigNumber(Date.now()),
    } as Order;

    // Fetch and print the order info
    let order1Info = await exchangeContract.getOrderInfo.callAsync(order1);
    let order2Info = await exchangeContract.getOrderInfo.callAsync(order2);
    let order3Info = await exchangeContract.getOrderInfo.callAsync(order3);
    printOrderInfos({ order1: order1Info, order2: order2Info, order3: order3Info });

    // Maker cancels all orders before and including order2, order3 remains valid
    const targetOrderEpoch = order2.salt;
    const txHash = await exchangeContract.cancelOrdersUpTo.sendTransactionAsync(targetOrderEpoch, {
        ...TX_DEFAULTS,
        from: maker,
    });
    const txReceipt = await awaitTransactionMinedSpinnerAsync('cancelOrdersUpTo', txHash);
    printTransaction('cancelOrdersUpTo', txReceipt, [['targetOrderEpoch', targetOrderEpoch.toString()]]);
    // Fetch and print the order info
    order1Info = await exchangeContract.getOrderInfo.callAsync(order1);
    order2Info = await exchangeContract.getOrderInfo.callAsync(order2);
    order3Info = await exchangeContract.getOrderInfo.callAsync(order3);
    printOrderInfos({ order1: order1Info, order2: order2Info, order3: order3Info });

    // Stop the Provider Engine
    providerEngine.stop();
}

(async () => {
    try {
        if (!module.parent) await scenario();
    } catch (e) {
        console.log(e);
        providerEngine.stop();
    }
})();
