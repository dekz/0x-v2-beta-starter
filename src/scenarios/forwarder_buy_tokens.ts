import { ZeroEx } from '0x.js';
import { MessagePrefixType } from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NETWORK_ID, NULL_ADDRESS, TX_DEFAULTS, ZERO } from '../constants';
import { etherTokenContract, forwarderContract, providerEngine, zrxTokenContract } from '../contracts';
import {
    awaitTransactionMinedSpinnerAsync,
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    printData,
    printScenario,
    printTransaction,
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario() {
    // In this scenario, the maker creates and signs an order for selling ZRX for WETH.
    // The taker takes uses the forwarding contract and buys these tokens.
    printScenario('Forwarder Buy Tokens');
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [maker, taker] = await zeroEx.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(100);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = ZeroEx.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for makerAccount
    const makerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenContract.address,
        maker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash, zeroEx);
    // With the Forwarding contract, the taker requires 0 additional set up
    printData('Setup', [['Maker ZRX Approval', makerZRXApprovalTxHash]]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);
    const exchangeAddress = zeroEx.exchange.getContractAddress();

    // Create the order
    const order = {
        exchangeAddress,
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: randomExpiration,
        salt: ZeroEx.generatePseudoRandomSalt(),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFee: ZERO,
        takerFee: ZERO,
    } as Order;

    printData('Order', Object.entries(order));

    // Print out the Balances and Allowances
    const erc20ProxyAddress = zeroEx.erc20Proxy.getContractAddress();
    await fetchAndPrintAllowancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintBalancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract]);

    // Create the order hash
    const orderHashHex = ZeroEx.getOrderHashHex(order);
    const ecSignature = await zeroEx.ecSignOrderHashAsync(orderHashHex, maker, {
        prefixType: MessagePrefixType.EthSign,
        shouldAddPrefixBeforeCallingEthSign: false,
    });
    const signature = signingUtils.rsvToSignature(ecSignature);

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
    txReceipt = await awaitTransactionMinedSpinnerAsync('marketBuyTokensWithEth', txHash, zeroEx);
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
