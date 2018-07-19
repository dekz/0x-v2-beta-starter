// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetDataUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xproject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NULL_ADDRESS, TX_DEFAULTS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import {
    erc20ProxyAddress,
    etherTokenContract,
    exchangeContract,
    forwarderContract,
    mnemonicWallet,
    providerEngine,
    zrxTokenContract,
    dummyERC721TokenContracts,
    erc721ProxyAddress,
    web3Wrapper,
} from '../contracts';
import {
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    printData,
    printScenario,
    printTransaction,
    awaitTransactionMinedSpinnerAsync,
    fetchAndPrintERC721Owner,
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
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const maker = accounts[0];
    const taker = accounts[1];
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset: 1 ERC721 Token
    const makerAssetAmount = new BigNumber(1);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    const tokenId = generatePseudoRandomSalt();
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetDataUtils.encodeERC721AssetData(dummyERC721TokenContract.address, tokenId);
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Mint a new ERC721 token for the maker
    const mintTxHash = await dummyERC721TokenContract.mint.sendTransactionAsync(maker, tokenId, { from: maker });
    txReceipt = await awaitTransactionMinedSpinnerAsync('Mint ERC721 Token', mintTxHash);
    // Approve the new ERC721 Proxy to move the ERC721 tokens for maker
    const makerERC721ApproveTxHash = await dummyERC721TokenContract.setApprovalForAll.sendTransactionAsync(
        erc721ProxyAddress,
        true,
        {
            from: maker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ERC721 Token Approval', makerERC721ApproveTxHash);

    // With the Forwarding contract, the taker requires 0 additional set up
    printData('Setup', [['Mint ERC721 Token', mintTxHash], ['Maker ERC721 Token Approval', makerERC721ApproveTxHash]]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);

    // Create the order
    const order = {
        exchangeAddress: exchangeContract.address,
        makerAddress: maker,
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

    printData('Order', Object.entries(order));

    // Print out the Balances and Allowances
    await fetchAndPrintAllowancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintERC721Owner({ maker, taker }, dummyERC721TokenContract, tokenId);
    await fetchAndPrintBalancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract]);

    // Create the order hash
    const orderHashBuffer = orderHashUtils.getOrderHashBuffer(order);
    const orderHashHex = `0x${orderHashBuffer.toString('hex')}`;
    const signatureBuffer = await signingUtils.signMessageAsync(
        orderHashBuffer,
        maker,
        mnemonicWallet,
        SignatureType.EthSign,
    );
    const signature = `0x${signatureBuffer.toString('hex')}`;

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
    txReceipt = await awaitTransactionMinedSpinnerAsync('marketBuyTokensWithEth', txHash);
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
