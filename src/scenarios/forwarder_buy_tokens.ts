// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetProxyUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xProject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NULL_ADDRESS, TX_DEFAULTS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import {
    erc20ProxyAddress,
    etherTokenContract,
    exchangeContract,
    forwarderContract,
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
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario() {
    // In this scenario, the maker creates and signs an order for selling ZRX for WETH.
    // The taker takes uses the forwarding contract and buys these tokens.
    printScenario('Forwarder Buy Tokens');
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const maker = accounts[0];
    const taker = accounts[1];
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(100);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetProxyUtils.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = assetProxyUtils.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for makerAccount
    const makerZRXApprovalTxHash = await zrxTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: maker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash);
    // With the Forwarding contract, the taker requires 0 additional set up
    printData('Setup', [['Maker ZRX Approval', makerZRXApprovalTxHash]]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);

    // Create the order
    const order = {
        exchangeAddress: exchangeContract.address,
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: randomExpiration,
        salt: generatePseudoRandomSalt(),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFee: ZERO,
        takerFee: ZERO,
    } as Order;

    printData('Order', Object.entries(order));

    // Print out the Balances and Allowances
    await fetchAndPrintAllowancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintBalancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract]);

    // Create the order hash
    const orderHashBuffer = orderHashUtils.getOrderHashBuffer(order);
    const orderHashHex = `0x${orderHashBuffer.toString('hex')}`;
    const signatureBuffer = await signingUtils.signMessageAsync(
        orderHashBuffer,
        maker,
        mnemonicWallet,
        SignatureType.EthSign,
    );
    const signature = `0x${signatureBuffer.toString('hex')}`;

    txHash = await forwarderContract.marketBuyTokensWithEth.sendTransactionAsync(
        [order],
        [signature],
        [],
        [],
        order.makerAssetAmount,
        0,
        NULL_ADDRESS,
        {
            ...TX_DEFAULTS,
            from: taker,
            value: order.takerAssetAmount,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('marketBuyTokensWithEth', txHash);
    printTransaction('marketBuyTokensWithEth', txReceipt, [['orderHash', orderHashHex]]);

    // Print the Balances
    await fetchAndPrintBalancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract]);

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
