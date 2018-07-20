import { ZeroEx } from '0x.js';
import { MessagePrefixType } from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NETWORK_ID, NULL_ADDRESS, ZERO, TX_DEFAULTS } from '../constants';
import { etherTokenContract, providerEngine, zrxTokenContract } from '../contracts';
import {
    awaitTransactionMinedSpinnerAsync,
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    printData,
    printScenario,
    printTransaction,
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario(): Promise<void> {
    // In this scenario, the maker creates and signs an order (leftOrder) for selling ZRX for WETH.
    // The taker has a matched (or mirrored) order (rightOrder) of WETH for ZRX.
    // The matcher submits these orders and to the 0x Exchange contract.
    // In this scenario, the matcher pays taker fees on both orders, the leftMaker pays the leftOrder maker fee
    // and the rightMaker pays the rightOrder maker fee.
    printScenario('Match Orders');
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [leftMaker, rightMaker, matcherAccount] = await zeroEx.getAvailableAddressesAsync();
    printData('Accounts', [['Left Maker', leftMaker], ['Right Maker', rightMaker], ['Order Matcher', matcherAccount]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(10);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(4);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = ZeroEx.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for makerAccount
    const leftMakerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenContract.address,
        leftMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Left Maker ZRX Approval', leftMakerZRXApprovalTxHash, zeroEx);

    // Approve the new ERC20 Proxy to move ZRX for rightMaker
    const rightMakerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenContract.address,
        rightMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Right Maker ZRX Approval',
        rightMakerZRXApprovalTxHash,
        zeroEx,
    );

    // Approve the new ERC20 Proxy to move ZRX for matcherAccount
    const matcherZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenContract.address,
        matcherAccount,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Matcher ZRX Approval', matcherZRXApprovalTxHash, zeroEx);

    // Approve the new ERC20 Proxy to move WETH for rightMaker
    const rightMakerWETHApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(
        etherTokenContract.address,
        rightMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Right Maker WETH Approval',
        rightMakerZRXApprovalTxHash,
        zeroEx,
    );

    // Deposit ETH into WETH for the taker
    const rightMakerWETHDepositTxHash = await zeroEx.etherToken.depositAsync(
        etherTokenContract.address,
        takerAssetAmount,
        rightMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Right Maker WETH Deposit',
        rightMakerWETHDepositTxHash,
        zeroEx,
    );

    printData('Setup', [
        ['Left Maker ZRX Approval', leftMakerZRXApprovalTxHash],
        ['Right Maker ZRX Approval', rightMakerZRXApprovalTxHash],
        ['Matcher Maker ZRX Approval', matcherZRXApprovalTxHash],
        ['Right Maker WETH Approval', rightMakerWETHApprovalTxHash],
        ['RIght Maker WETH Deposit', rightMakerWETHDepositTxHash],
    ]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);
    const exchangeAddress = zeroEx.exchange.getContractAddress();

    // Create the order
    const leftOrder = {
        exchangeAddress,
        makerAddress: leftMaker,
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
    printData('Left Order', Object.entries(leftOrder));

    // Create the matched order
    const rightOrderTakerAssetAmount = new BigNumber(2);
    const rightOrder = {
        exchangeAddress,
        makerAddress: rightMaker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: randomExpiration,
        salt: ZeroEx.generatePseudoRandomSalt(),
        makerAssetAmount: leftOrder.takerAssetAmount,
        takerAssetAmount: rightOrderTakerAssetAmount,
        makerAssetData: leftOrder.takerAssetData,
        takerAssetData: leftOrder.makerAssetData,
        makerFee: ZERO,
        takerFee: ZERO,
    } as Order;
    printData('Right Order', Object.entries(rightOrder));

    const leftOrderHashHex = ZeroEx.getOrderHashHex(leftOrder);
    const leftECSignature = await zeroEx.ecSignOrderHashAsync(leftOrderHashHex, leftMaker, {
        prefixType: MessagePrefixType.EthSign,
        shouldAddPrefixBeforeCallingEthSign: false,
    });
    const leftOrderSignature = signingUtils.rsvToSignature(leftECSignature);
    const leftSignedOrder = { ...leftOrder, signature: leftOrderSignature };

    const rightOrderHashHex = ZeroEx.getOrderHashHex(rightOrder);
    const rightECSignature = await zeroEx.ecSignOrderHashAsync(rightOrderHashHex, rightMaker, {
        prefixType: MessagePrefixType.EthSign,
        shouldAddPrefixBeforeCallingEthSign: false,
    });
    const rightOrderSignature = signingUtils.rsvToSignature(rightECSignature);
    const rightSignedOrder = { ...rightOrder, signature: rightOrderSignature };

    // Print out the Balances and Allowances
    const erc20ProxyAddress = zeroEx.erc20Proxy.getContractAddress();
    await fetchAndPrintAllowancesAsync(
        { leftMaker, rightMaker },
        [zrxTokenContract, etherTokenContract],
        erc20ProxyAddress,
    );
    await fetchAndPrintBalancesAsync({ leftMaker, rightMaker, matcherAccount }, [zrxTokenContract, etherTokenContract]);
    // Match the orders via 0x Exchange
    txHash = await zeroEx.exchange.matchOrdersAsync(leftSignedOrder, rightSignedOrder, matcherAccount, {
        gasLimit: TX_DEFAULTS.gas,
    });

    txReceipt = await awaitTransactionMinedSpinnerAsync('matchOrders', txHash, zeroEx);
    printTransaction('matchOrders', txReceipt, [
        ['left orderHash', leftOrderHashHex],
        ['right orderHash', rightOrderHashHex],
    ]);

    // Print the Balances
    await fetchAndPrintBalancesAsync({ leftMaker, rightMaker, matcherAccount }, [zrxTokenContract, etherTokenContract]);

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
