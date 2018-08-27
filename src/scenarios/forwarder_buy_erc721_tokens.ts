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
import { dummyERC721TokenContracts, forwarderContract, providerEngine } from '../contracts';
import {
    awaitTransactionMinedSpinnerAsync,
    fetchAndPrintERC721Owner,
    printData,
    printScenario,
    printTransaction,
    fetchAndPrintContractAllowancesAsync,
    fetchAndPrintContractBalancesAsync,
} from '../print_utils';

export async function scenario() {
    // In this scenario, the maker creates and signs an order for selling ZRX for WETH.
    // The taker takes uses the forwarding contract and buys these tokens.
    printScenario('Forwarder Buy ERC721 token');
    const dummyERC721TokenContract = dummyERC721TokenContracts[0];
    if (!dummyERC721TokenContract) {
        console.log('No Dummy ERC721 Tokens deployed on this network');
        return;
    }
    // Initialize the ContractWrappers, this provides helper functions around calling
    // contracts on the blockchain
    const contractWrappers = new ContractWrappers(providerEngine, { networkId: NETWORK_ID });
    // Initialize the Web3Wraper, this provides helper functions around calling
    // account information, balances, general contract logs
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [maker, taker] = await web3Wrapper.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset: 1 ERC721 Token
    const makerAssetAmount = new BigNumber(1);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    const tokenId = generatePseudoRandomSalt();
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const etherTokenAddress = contractWrappers.etherToken.getContractAddressIfExists();
    const makerAssetData = assetDataUtils.encodeERC721AssetData(dummyERC721TokenContract.address, tokenId);
    const takerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenAddress);
    let txHash;
    let txReceipt;

    // Mint a new ERC721 token for the maker
    const mintTxHash = await dummyERC721TokenContract.mint.sendTransactionAsync(maker, tokenId, { from: maker });
    txReceipt = await awaitTransactionMinedSpinnerAsync('Mint ERC721 Token', mintTxHash, web3Wrapper);
    // Approve the new ERC721 Proxy to move the ERC721 tokens for maker
    const makerERC721ApprovalTxHash = await contractWrappers.erc721Token.setProxyApprovalForAllAsync(
        dummyERC721TokenContract.address,
        maker,
        true,
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync(
        'Maker ERC721 Approval',
        makerERC721ApprovalTxHash,
        web3Wrapper,
    );

    // With the Forwarding contract, the taker requires 0 additional set up
    printData('Setup', [['Mint ERC721 Token', mintTxHash], ['Maker ERC721 Token Approval', makerERC721ApprovalTxHash]]);

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);
    const exchangeAddress = contractWrappers.exchange.getContractAddress();

    // Create the order
    const order = {
        exchangeAddress,
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
    const erc20ProxyAddress = contractWrappers.erc20Proxy.getContractAddress();
    await fetchAndPrintContractAllowancesAsync(
        { maker, taker },
        { WETH: etherTokenAddress },
        erc20ProxyAddress,
        contractWrappers.erc20Token,
    );
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );
    await fetchAndPrintERC721Owner({ maker, taker }, dummyERC721TokenContract, tokenId);

    // Create the order hash
    const orderHashHex = orderHashUtils.getOrderHashHex(order);
    const signature = await signatureUtils.ecSignOrderHashAsync(
        providerEngine,
        orderHashHex,
        maker,
        SignerType.Default,
    );

    txHash = await forwarderContract.marketBuyOrdersWithEth.sendTransactionAsync(
        [order],
        order.makerAssetAmount,
        [signature],
        [],
        [],
        new BigNumber(0),
        NULL_ADDRESS,
        {
            ...TX_DEFAULTS,
            from: taker,
            value: order.takerAssetAmount,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('marketBuyTokensWithEth', txHash, web3Wrapper);
    printTransaction('marketBuyTokensWithEth', txReceipt, [['orderHash', orderHashHex]]);

    // Print the Balances
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );
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
