import { ZeroEx } from '0x.js';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NETWORK_ID, NULL_ADDRESS } from '../constants';
import { providerEngine, zrxTokenAddress } from '../contracts';
import {
    awaitTransactionMinedSpinnerAsync,
    printData,
    printScenario,
    printTransaction,
    fetchAndPrintContractAllowancesAsync,
    fetchAndPrintContractBalancesAsync,
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario() {
    // In this scenario, the maker creates and signs an order for selling ZRX for WETH.
    // This order has ZRX fees for both the maker and taker, paid out to the fee recipient.
    // The taker takes this order and fills it via the 0x Exchange contract.
    printScenario('Fill Order with Fees');
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [maker, taker, feeRecipient] = await zeroEx.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker], ['Fee Recipient', feeRecipient]]);

    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(100);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    // the amount of fees the maker pays in ZRX
    const makerFee = new BigNumber(1);
    // the amount of fees the taker pays in ZRX
    const takerFee = new BigNumber(1);

    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const etherTokenAddress = zeroEx.etherToken.getContractAddressIfExists();
    const makerAssetData = ZeroEx.encodeERC20AssetData(zrxTokenAddress);
    const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenAddress);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for maker and taker
    const makerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(zrxTokenAddress, maker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash, zeroEx);
    const takerZRXApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(zrxTokenAddress, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker ZRX Approval', takerZRXApprovalTxHash, zeroEx);

    // Approve the new ERC20 Proxy to move WETH for takerAccount
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
    const exchangeAddress = zeroEx.exchange.getContractAddress();

    // Create the order
    const order = {
        exchangeAddress,
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: feeRecipient,
        expirationTimeSeconds: randomExpiration,
        salt: ZeroEx.generatePseudoRandomSalt(),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFee,
        takerFee,
    } as Order;

    printData('Order', Object.entries(order));

    // Print out the Balances and Allowances
    const erc20ProxyAddress = zeroEx.erc20Proxy.getContractAddress();
    await fetchAndPrintContractAllowancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        erc20ProxyAddress,
        zeroEx,
    );
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        zeroEx,
    );

    // Create the order hash
    const orderHashHex = ZeroEx.getOrderHashHex(order);
    const signature = await zeroEx.ecSignOrderHashAsync(orderHashHex, maker);
    const signedOrder = { ...order, signature };
    // Fill the Order via 0x.js Exchange contract
    txHash = await zeroEx.exchange.fillOrderAsync(signedOrder, takerAssetAmount, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('fillOrder', txHash, zeroEx);
    printTransaction('fillOrder', txReceipt, [
        ['orderHash', orderHashHex],
        ['takerAssetAmount', takerAssetAmount.toString()],
    ]);

    // Print the Balances
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        zeroEx,
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
