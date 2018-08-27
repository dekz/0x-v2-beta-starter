import {
    assetDataUtils,
    BigNumber,
    ContractWrappers,
    generatePseudoRandomSalt,
    Order,
    orderHashUtils,
    signatureUtils,
    SignedOrder,
    SignerType,
} from '0x.js';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import { NETWORK_ID, NULL_ADDRESS, TX_DEFAULTS } from '../constants';
import { providerEngine } from '../contracts';
import {
    awaitTransactionMinedSpinnerAsync,
    fetchAndPrintContractAllowancesAsync,
    fetchAndPrintContractBalancesAsync,
    printData,
    printScenario,
    printTransaction,
} from '../print_utils';

export async function scenario(): Promise<void> {
    // In this scenario a third party, called the sender, submits the operation on behalf of the taker.
    // This allows a sender to pay the gas on behalf of the taker. It can be combined with a custom sender
    // contract with additional business logic. Or the sender can choose when the transaction should be
    // submitted, if at all.
    // The maker will create and sign the order. The signed order and extra parameters for the execute transaction
    // function call are signed by the taker. The signed execute transaction data is then submitted by the sender
    // to the 0x Exchange contract.
    printScenario('Execute Transaction fillOrder');
    // Initialize the ContractWrappers, this provides helper functions around calling
    // contracts on the blockchain
    const contractWrappers = new ContractWrappers(providerEngine, { networkId: NETWORK_ID });
    // Initialize the Web3Wraper, this provides helper functions around calling
    // account information, balances, general contract logs
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [maker, taker, sender] = await web3Wrapper.getAvailableAddressesAsync();
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
    const zrxTokenAddress = contractWrappers.exchange.getZRXTokenAddress();
    const makerAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenAddress);
    const etherTokenAddress = contractWrappers.etherToken.getContractAddressIfExists();
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenAddress);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for maker
    const makerZRXApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenAddress,
        maker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash, web3Wrapper);

    // Approve the new ERC20 Proxy to move ZRX for taker
    const takerZRXApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenAddress,
        taker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker ZRX Approval', takerZRXApprovalTxHash, web3Wrapper);

    // Approve the new ERC20 Proxy to move WETH for taker
    const takerWETHApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        etherTokenAddress,
        taker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApprovalTxHash, web3Wrapper);

    // Deposit ETH into WETH for the taker
    const takerWETHDepositTxHash = await contractWrappers.etherToken.depositAsync(
        etherTokenAddress,
        takerAssetAmount,
        taker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash, web3Wrapper);

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

    const exchangeAddress = contractWrappers.exchange.getContractAddress();
    const order = {
        ...orderWithoutExchangeAddress,
        exchangeAddress,
    } as Order;

    printData('Order', Object.entries(order));
    // Print out the Balances and Allowances
    const erc20ProxyAddress = contractWrappers.erc20Proxy.getContractAddress();
    await fetchAndPrintContractAllowancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        erc20ProxyAddress,
        contractWrappers.erc20Token,
    );
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );

    // Create the order hash
    const orderHashHex = orderHashUtils.getOrderHashHex(order);
    const signature = await signatureUtils.ecSignOrderHashAsync(
        providerEngine,
        orderHashHex,
        maker,
        SignerType.Default,
    );

    const signedOrder = {
        ...order,
        signature,
    } as SignedOrder;
    // The transaction encoder provides helpers in encoding 0x Exchange transactions to allow
    // a third party to submit the transaction. This operates in the context of the signer (taker)
    // rather then the context of the submitter (sender)
    const transactionEncoder = await contractWrappers.exchange.transactionEncoderAsync();
    // This is an ABI encoded function call that the taker wishes to perform
    // in this scenario it is a fillOrder
    const fillData = transactionEncoder.fillOrderTx(signedOrder, takerAssetAmount);
    // Generate a random salt to mitigate replay attacks
    const takerTransactionSalt = generatePseudoRandomSalt();
    // The taker signs the operation data (fillOrder) with the salt
    const executeTransactionHex = transactionEncoder.getTransactionHex(fillData, takerTransactionSalt, taker);
    const takerSignatureHex = await signatureUtils.ecSignOrderHashAsync(
        providerEngine,
        executeTransactionHex,
        taker,
        SignerType.Default,
    );
    // The sender submits this operation via executeTransaction passing in the signature from the taker
    txHash = await contractWrappers.exchange.executeTransactionAsync(
        takerTransactionSalt,
        taker,
        fillData,
        takerSignatureHex,
        sender,
        {
            gasLimit: TX_DEFAULTS.gas,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('executeTransaction', txHash, web3Wrapper);
    printTransaction('Execute Transaction fillOrder', txReceipt, [['orderHash', orderHashHex]]);

    // Print the Balances
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );

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
