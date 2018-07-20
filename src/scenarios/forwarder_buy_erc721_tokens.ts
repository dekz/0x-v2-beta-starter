import { ZeroEx } from '0x.js';
import { MessagePrefixType } from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NETWORK_ID, NULL_ADDRESS, TX_DEFAULTS, ZERO } from '../constants';
import {
    dummyERC721TokenContracts,
    etherTokenContract,
    forwarderContract,
    providerEngine,
    zrxTokenContract,
} from '../contracts';
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
    // In this scenario, the maker creates and signs an order for selling ZRX for WETH.
    // The taker takes uses the forwarding contract and buys these tokens.
    printScenario('Forwarder Buy ERC721 token');
    const dummyERC721TokenContract = dummyERC721TokenContracts[0];
    if (!dummyERC721TokenContract) {
        console.log('No Dummy ERC721 Tokens deployed on this network');
        return;
    }
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [maker, taker] = await zeroEx.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset: 1 ERC721 Token
    const makerAssetAmount = new BigNumber(1);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    const tokenId = ZeroEx.generatePseudoRandomSalt();
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = ZeroEx.encodeERC721AssetData(dummyERC721TokenContract.address, tokenId);
    const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenContract.address);
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

    // With the Forwarding contract, the taker requires 0 additional set up
    printData('Setup', [['Mint ERC721 Token', mintTxHash], ['Maker ERC721 Token Approval', makerERC721ApprovalTxHash]]);

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
    await fetchAndPrintERC721Owner({ maker, taker }, dummyERC721TokenContract, tokenId);
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
