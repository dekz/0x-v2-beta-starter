// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetDataUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xProject/order-utils';
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
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario(): Promise<void> {
    // In this scenario, the maker creates and signs an order (leftOrder) for selling ZRX for WETH.
    // The taker has a matched (or mirrored) order (rightOrder) of WETH for ZRX.
    // The matcher submits these orders and to the 0x Exchange contract.
    // In this scenario, the matcher pays taker fees on both orders, the leftMaker pays the leftOrder maker fee
    // and the rightMaker pays the rightOrder maker fee.
    printScenario('Match Orders');
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const leftMaker = accounts[0];
    const rightMaker = accounts[1];
    const matcherAccount = accounts[2];
    printData('Accounts', [['Left Maker', leftMaker], ['Right Maker', rightMaker], ['Order Matcher', matcherAccount]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(10);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(4);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for makerAccount
    const makerZRXApprovalTxHash = await zrxTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: leftMaker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash);

    // Approve the new ERC20 Proxy to move WETH for takerAccount
    const takerWETHApproveTxHash = await etherTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: rightMaker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApproveTxHash);

    // Deposit ETH into WETH for the taker
    const takerWETHDepositTxHash = await etherTokenContract.deposit.sendTransactionAsync({
        from: rightMaker,
        value: takerAssetAmount,
    });
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash);

    printData('Setup', [
        ['Maker ZRX Approval', makerZRXApprovalTxHash],
        ['Taker WETH Approval', takerWETHApproveTxHash],
        ['Taker WETH Deposit', takerWETHDepositTxHash],
    ]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);

    // Create the order
    const leftOrder = {
        exchangeAddress: exchangeContract.address,
        makerAddress: leftMaker,
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
    printData('Left Order', Object.entries(leftOrder));

    // Create the matched order
    const rightOrderTakerAssetAmount = new BigNumber(2);
    const rightOrder = {
        exchangeAddress: exchangeContract.address,
        makerAddress: rightMaker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: randomExpiration,
        salt: generatePseudoRandomSalt(),
        makerAssetAmount: leftOrder.takerAssetAmount,
        takerAssetAmount: rightOrderTakerAssetAmount,
        makerAssetData: leftOrder.takerAssetData,
        takerAssetData: leftOrder.makerAssetData,
        makerFee: ZERO,
        takerFee: ZERO,
    } as Order;
    printData('Right Order', Object.entries(rightOrder));

    // Create the order hash and signature
    const leftOrderHashBuffer = orderHashUtils.getOrderHashBuffer(leftOrder);
    const leftOrderHashHex = `0x${leftOrderHashBuffer.toString('hex')}`;
    const leftSignatureBuffer = await signingUtils.signMessageAsync(
        leftOrderHashBuffer,
        leftMaker,
        mnemonicWallet,
        SignatureType.EthSign,
    );
    const leftSignature = `0x${leftSignatureBuffer.toString('hex')}`;

    // Create the matched order hash and signature
    const rightOrderHashBuffer = orderHashUtils.getOrderHashBuffer(rightOrder);
    const rightOrderHashHex = `0x${rightOrderHashBuffer.toString('hex')}`;
    const rightSignatureBuffer = await signingUtils.signMessageAsync(
        rightOrderHashBuffer,
        rightMaker,
        mnemonicWallet,
        SignatureType.EthSign,
    );
    const rightSignature = `0x${rightSignatureBuffer.toString('hex')}`;

    // Print out the Balances and Allowances
    await fetchAndPrintAllowancesAsync(
        { leftMaker, rightMaker },
        [zrxTokenContract, etherTokenContract],
        erc20ProxyAddress,
    );
    await fetchAndPrintBalancesAsync({ leftMaker, rightMaker, matcherAccount }, [zrxTokenContract, etherTokenContract]);

    txHash = await exchangeContract.matchOrders.sendTransactionAsync(
        leftOrder,
        rightOrder,
        leftSignature,
        rightSignature,
        {
            ...TX_DEFAULTS,
            from: matcherAccount,
        },
    );

    txReceipt = await awaitTransactionMinedSpinnerAsync('matchOrders', txHash);
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
