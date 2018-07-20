import { ZeroEx } from '0x.js';
import { assetDataUtils, MessagePrefixType } from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NETWORK_ID, NULL_ADDRESS, TX_DEFAULTS, ZERO } from '../constants';
import { dummyERC721TokenContracts, providerEngine, etherTokenContract } from '../contracts';
import {
    awaitTransactionMinedSpinnerAsync,
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    fetchAndPrintERC721Owner,
    printData,
    printScenario,
    printTransaction,
} from '../print_utils';
import { signingUtils } from '../signing_utils';

export async function scenario() {
    // In this scenario, the maker creates and signs an order for selling an ERC721 token for WETH.
    // The taker takes this order and fills it via the 0x Exchange contract.
    printScenario('Fill Order ERC721');
    const dummyERC721TokenContract = dummyERC721TokenContracts[0];
    if (!dummyERC721TokenContract) {
        console.log('No Dummy ERC721 Tokens deployed on this network');
        return;
    }
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [maker, taker] = await zeroEx.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset (1 ERC721 Token)
    const makerAssetAmount = new BigNumber(1);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    const tokenId = ZeroEx.generatePseudoRandomSalt();
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetDataUtils.encodeERC721AssetData(dummyERC721TokenContract.address, tokenId);
    const etherTokenAddress = zeroEx.etherToken.getContractAddressIfExists();
    const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenAddress);
    let txHash;
    let txReceipt;

    // Mint a new ERC721 token for the maker
    const mintTxHash = await dummyERC721TokenContract.mint.sendTransactionAsync(maker, tokenId, { from: maker });
    txReceipt = await awaitTransactionMinedSpinnerAsync('Mint ERC721 Token', mintTxHash, zeroEx);

    // Approve the new ERC721 Proxy to move the ERC721 tokens for maker
    const makerERC721ApprovalTxHash = await zeroEx.erc721Token.setProxyApprovalForAllAsync(
        dummyERC721TokenContract.address,
        maker,
        true,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ERC721 Approval', makerERC721ApprovalTxHash, zeroEx);

    // Approve the new ERC20 Proxy to move WETH for takerAccount
    const takerWETHApprovalTxHash = await zeroEx.erc20Token.setUnlimitedProxyAllowanceAsync(etherTokenAddress, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApprovalTxHash, zeroEx);

    // Deposit ETH into WETH for the taker
    const takerWETHDepositTxHash = await zeroEx.etherToken.depositAsync(etherTokenAddress, takerAssetAmount, taker);
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash, zeroEx);

    printData('Setup', [
        ['Mint ERC721', mintTxHash],
        ['Maker ERC721 Approval', makerERC721ApprovalTxHash],
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
    await fetchAndPrintAllowancesAsync({ maker, taker }, [etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintBalancesAsync({ maker, taker }, [dummyERC721TokenContract, etherTokenContract]);
    await fetchAndPrintERC721Owner({ maker, taker }, dummyERC721TokenContract, tokenId);

    // Create the order hash
    const orderHashHex = ZeroEx.getOrderHashHex(order);
    const ecSignature = await zeroEx.ecSignOrderHashAsync(orderHashHex, maker, {
        prefixType: MessagePrefixType.EthSign,
        shouldAddPrefixBeforeCallingEthSign: false,
    });
    const signature = signingUtils.rsvToSignature(ecSignature);
    const signedOrder = { ...order, signature };
    // Fill the Order via 0x.js Exchange contract
    txHash = await zeroEx.exchange.fillOrderAsync(signedOrder, takerAssetAmount, taker, { gasLimit: TX_DEFAULTS.gas });
    txReceipt = await awaitTransactionMinedSpinnerAsync('fillOrder', txHash, zeroEx);
    printTransaction('fillOrder', txReceipt, [['orderHash', orderHashHex]]);

    // Print the Balances
    await fetchAndPrintBalancesAsync({ maker, taker }, [dummyERC721TokenContract, etherTokenContract]);
    await fetchAndPrintERC721Owner({ maker, taker }, dummyERC721TokenContract, tokenId);

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
