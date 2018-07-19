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
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario(): Promise<void> {
    // In this scenario a third party, called the sender, submits the operation on behalf of the taker.
    // This allows a sender to pay the gas on behalf of the taker. It can be combined with a custom sender
    // contract with additional business logic. Or the sender can choose when the transaction should be
    // submitted, if at all.
    // The maker will create and sign the order. The signed order and extra parameters for the execute transaction
    // function call are signed by the taker. The signed execute transaction data is then submitted by the sender
    // to the 0x Exchange contract.
    printScenario('Execute Transaction fillOrder');
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const maker = accounts[0];
    const taker = accounts[1];
    const sender = accounts[2];
    const feeRecipientAddress = sender;
    printData('Accounts', [['Maker', maker], ['Taker', taker], ['Sender', sender]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(100);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    // the amount the maker pays in fees
    const makerFee = new BigNumber(2);
    // the amount the taker pays in fees
    const takerFee = new BigNumber(3);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for maker
    const makerZRXApprovalTxHash = await zrxTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: maker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash);

    // Approve the new ERC20 Proxy to move ZRX for taker
    const takerZRXApprovalTxHash = await zrxTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: taker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker ZRX Approval', takerZRXApprovalTxHash);

    // Approve the new ERC20 Proxy to move WETH for taker
    const takerWETHApprovalTxHash = await etherTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: taker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApprovalTxHash);

    // Deposit ETH into WETH for the taker
    const takerWETHDepositTxHash = await etherTokenContract.deposit.sendTransactionAsync({
        from: taker,
        value: takerAssetAmount,
    });
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash);

    printData('Setup', [
        ['Maker ZRX Approval', makerZRXApprovalTxHash],
        ['Taker ZRX Approval', takerZRXApprovalTxHash],
        ['Taker WETH Approval', takerWETHApprovalTxHash],
        ['Taker WETH Deposit', takerWETHDepositTxHash],
    ]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);

    // Create the order
    const orderWithoutExchangeAddress = {
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress,
        expirationTimeSeconds: randomExpiration,
        salt: generatePseudoRandomSalt(),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFee,
        takerFee,
    };

    const order = {
        ...orderWithoutExchangeAddress,
        exchangeAddress: exchangeContract.address,
    } as Order;

    printData('Order', Object.entries(order));

    // Print out the Balances and Allowances
    await fetchAndPrintAllowancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintBalancesAsync({ maker, taker, sender }, [zrxTokenContract, etherTokenContract]);

    // Create the order hash
    const orderHashBuffer = orderHashUtils.getOrderHashBuffer(order);
    const signatureBuffer = await signingUtils.signMessageAsync(
        orderHashBuffer,
        maker,
        mnemonicWallet,
        SignatureType.EthSign,
    );
    const orderHashHex = `0x${orderHashBuffer.toString('hex')}`;
    const signature = `0x${signatureBuffer.toString('hex')}`;

    // This is an ABI encoded function call that the taker wishes to perform
    // in this scenario it is a fillOrder
    const fillData = exchangeContract.fillOrder.getABIEncodedTransactionData(
        orderWithoutExchangeAddress,
        takerAssetAmount,
        signature,
    );
    // Generate a random salt to mitigate replay attacks
    const takerTransactionSalt = generatePseudoRandomSalt();
    // The taker signs the operation data (fillOrder) with the salt
    const takerSignatureBuffer = await signingUtils.newSignedTransactionAsync(
        fillData,
        takerTransactionSalt,
        taker,
        exchangeContract.address,
        mnemonicWallet,
    );
    const takerSignature = `0x${takerSignatureBuffer.toString('hex')}`;
    // The sender submits this operation via executeTransaction passing in the signature from the taker
    txHash = await exchangeContract.executeTransaction.sendTransactionAsync(
        takerTransactionSalt,
        taker,
        fillData,
        takerSignature,
        {
            ...TX_DEFAULTS,
            from: sender,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('executeTransaction', txHash);

    printTransaction('Execute Transaction fillOrder', txReceipt, [['orderHash', orderHashHex]]);

    // Print the Balances
    await fetchAndPrintBalancesAsync({ maker, taker, sender }, [zrxTokenContract, etherTokenContract]);

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
