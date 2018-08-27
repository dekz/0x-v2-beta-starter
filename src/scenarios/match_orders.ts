import {
    assetDataUtils,
    BigNumber,
    ContractWrappers,
    generatePseudoRandomSalt,
    Order,
    orderHashUtils,
    signatureUtils,
    SignerType,
} from '0x.js';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import { NETWORK_ID, NULL_ADDRESS, TX_DEFAULTS, ZERO } from '../constants';
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
    // In this scenario, the maker creates and signs an order (leftOrder) for selling ZRX for WETH.
    // The taker has a matched (or mirrored) order (rightOrder) of WETH for ZRX.
    // The matcher submits these orders and to the 0x Exchange contract.
    // In this scenario, the matcher pays taker fees on both orders, the leftMaker pays the leftOrder maker fee
    // and the rightMaker pays the rightOrder maker fee.
    printScenario('Match Orders');
    // Initialize the ContractWrappers, this provides helper functions around calling
    // contracts on the blockchain
    const contractWrappers = new ContractWrappers(providerEngine, { networkId: NETWORK_ID });
    // Initialize the Web3Wraper, this provides helper functions around calling
    // account information, balances, general contract logs
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [leftMaker, rightMaker, matcherAccount] = await web3Wrapper.getAvailableAddressesAsync();
    printData('Accounts', [['Left Maker', leftMaker], ['Right Maker', rightMaker], ['Order Matcher', matcherAccount]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(10);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(4);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const etherTokenAddress = contractWrappers.etherToken.getContractAddressIfExists();
    const zrxTokenAddress = contractWrappers.exchange.getZRXTokenAddress();
    const makerAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenAddress);
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenAddress);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for makerAccount
    const leftMakerZRXApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenAddress,
        leftMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Left Maker ZRX Approval',
        leftMakerZRXApprovalTxHash,
        web3Wrapper,
    );

    // Approve the new ERC20 Proxy to move ZRX for rightMaker
    const rightMakerZRXApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenAddress,
        rightMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Right Maker ZRX Approval',
        rightMakerZRXApprovalTxHash,
        web3Wrapper,
    );

    // Approve the new ERC20 Proxy to move ZRX for matcherAccount
    const matcherZRXApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        zrxTokenAddress,
        matcherAccount,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Matcher ZRX Approval', matcherZRXApprovalTxHash, web3Wrapper);

    // Approve the new ERC20 Proxy to move WETH for rightMaker
    const rightMakerWETHApprovalTxHash = await contractWrappers.erc20Token.setUnlimitedProxyAllowanceAsync(
        etherTokenAddress,
        rightMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Right Maker WETH Approval',
        rightMakerZRXApprovalTxHash,
        web3Wrapper,
    );

    // Deposit ETH into WETH for the taker
    const rightMakerWETHDepositTxHash = await contractWrappers.etherToken.depositAsync(
        etherTokenAddress,
        takerAssetAmount,
        rightMaker,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Right Maker WETH Deposit',
        rightMakerWETHDepositTxHash,
        web3Wrapper,
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
    const exchangeAddress = contractWrappers.exchange.getContractAddress();

    // Create the order
    const leftOrder = {
        exchangeAddress,
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
        exchangeAddress,
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

    const leftOrderHashHex = orderHashUtils.getOrderHashHex(leftOrder);
    const leftOrderSignature = await signatureUtils.ecSignOrderHashAsync(
        providerEngine,
        leftOrderHashHex,
        leftMaker,
        SignerType.Default,
    );
    const leftSignedOrder = { ...leftOrder, signature: leftOrderSignature };

    const rightOrderHashHex = orderHashUtils.getOrderHashHex(rightOrder);
    const rightOrderSignature = await signatureUtils.ecSignOrderHashAsync(
        providerEngine,
        rightOrderHashHex,
        rightMaker,
        SignerType.Default,
    );
    const rightSignedOrder = { ...rightOrder, signature: rightOrderSignature };

    // Print out the Balances and Allowances
    const erc20ProxyAddress = contractWrappers.erc20Proxy.getContractAddress();

    await fetchAndPrintContractAllowancesAsync(
        { leftMaker, rightMaker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        erc20ProxyAddress,
        contractWrappers.erc20Token,
    );
    await fetchAndPrintContractBalancesAsync(
        { leftMaker, rightMaker, matcherAccount },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );
    // Match the orders via 0x Exchange
    txHash = await contractWrappers.exchange.matchOrdersAsync(leftSignedOrder, rightSignedOrder, matcherAccount, {
        gasLimit: TX_DEFAULTS.gas,
    });

    txReceipt = await awaitTransactionMinedSpinnerAsync('matchOrders', txHash, web3Wrapper);
    printTransaction('matchOrders', txReceipt, [
        ['left orderHash', leftOrderHashHex],
        ['right orderHash', rightOrderHashHex],
    ]);

    // Print the Balances
    await fetchAndPrintContractBalancesAsync(
        { leftMaker, rightMaker, matcherAccount },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );

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
