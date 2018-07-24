import { ZeroEx } from '0x.js';
import { MessagePrefixType } from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NETWORK_ID, NULL_ADDRESS, TX_DEFAULTS } from '../constants';
import {
    etherTokenContract,
    exchangeContract,
    mnemonicWallet,
    providerEngine,
    zrxTokenContract,
    zrxTokenAddress,
} from '../contracts';
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
    // In this scenario a third party, called the sender, submits the operation on behalf of the taker.
    // This allows a sender to pay the gas on behalf of the taker. It can be combined with a custom sender
    // contract with additional business logic. Or the sender can choose when the transaction should be
    // submitted, if at all.
    // The maker will create and sign the order. The signed order and extra parameters for the execute transaction
    // function call are signed by the taker. The signed execute transaction data is then submitted by the sender
    // to the 0x Exchange contract.
    printScenario('Execute Transaction fillOrder');
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [maker, taker, sender] = await zeroEx.getAvailableAddressesAsync();
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
    const makerAssetData = ZeroEx.encodeERC20AssetData(zrxTokenAddress);
    const etherTokenAddress = zeroEx.etherToken.getContractAddressIfExists();
    const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenAddress);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for maker
    const makerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(zrxTokenAddress, maker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash, zeroEx);

    // Approve the new ERC20 Proxy to move ZRX for taker
    const takerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(zrxTokenAddress, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker ZRX Approval', takerZRXApprovalTxHash, zeroEx);

    // Approve the new ERC20 Proxy to move WETH for taker
    const takerWETHApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(etherTokenAddress, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApprovalTxHash, zeroEx);

    // Deposit ETH into WETH for the taker
    const takerWETHDepositTxHash = await zeroEx.etherToken.depositAsync(etherTokenAddress, takerAssetAmount, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash, zeroEx);

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
        salt: ZeroEx.generatePseudoRandomSalt(),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFee,
        takerFee,
    };

    const exchangeAddress = zeroEx.exchange.getContractAddress();
    const order = {
        ...orderWithoutExchangeAddress,
        exchangeAddress,
    } as Order;

    printData('Order', Object.entries(order));
    // Print out the Balances and Allowances
    const erc20ProxyAddress = zeroEx.erc20Proxy.getContractAddress();
    await fetchAndPrintAllowancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintBalancesAsync({ maker, taker, sender }, [zrxTokenContract, etherTokenContract]);

    // Create the order hash
    const orderHashHex = ZeroEx.getOrderHashHex(order);
    const ecSignature = await zeroEx.ecSignOrderHashAsync(orderHashHex, maker, {
        prefixType: MessagePrefixType.EthSign,
        shouldAddPrefixBeforeCallingEthSign: false,
    });
    const signature = signingUtils.rsvToSignature(ecSignature);

    // This is an ABI encoded function call that the taker wishes to perform
    // in this scenario it is a fillOrder
    const fillData = exchangeContract.fillOrder.getABIEncodedTransactionData(
        orderWithoutExchangeAddress,
        takerAssetAmount,
        signature,
    );
    // Generate a random salt to mitigate replay attacks
    const takerTransactionSalt = ZeroEx.generatePseudoRandomSalt();
    // The taker signs the operation data (fillOrder) with the salt
    const executeTransactionHex = await signingUtils.getExecuteTransactionHex(
        fillData,
        takerTransactionSalt,
        taker,
        exchangeAddress,
    );
    const takerSignatureHex = await signingUtils.signExecuteTransactionHexAsync(
        executeTransactionHex,
        taker,
        mnemonicWallet,
    );
    const takerSignatureValid = await zeroEx.isValidSignatureAsync(executeTransactionHex, takerSignatureHex, taker);
    if (!takerSignatureValid) {
        throw new Error('takerSignature invalid');
    }
    // The sender submits this operation via executeTransaction passing in the signature from the taker
    txHash = await zeroEx.exchange.executeTransactionAsync(
        takerTransactionSalt,
        taker,
        fillData,
        takerSignatureHex,
        sender,
        {
            gasLimit: TX_DEFAULTS.gas,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('executeTransaction', txHash, zeroEx);
    printTransaction('Execute Transaction fillOrder', txReceipt, [['orderHash', orderHashHex]]);

    // Print the Balances
    await fetchAndPrintBalancesAsync({ maker, taker, sender }, [zrxTokenContract, etherTokenContract]);

    // Stop the Provider Engine
    providerEngine.stop();
}

(async () => {
    try {
        if (!module.parent) {
            await scenario();
        }
    } catch (e) {
        console.log(e);
        providerEngine.stop();
    }
})();
