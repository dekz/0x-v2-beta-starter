// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetProxyUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xProject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NULL_ADDRESS, TX_DEFAULTS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import {
    erc20ProxyAddress,
    erc721ProxyAddress,
    etherTokenContract,
    exchangeContract,
    dummyERC721TokenContracts,
    mnemonicWallet,
    providerEngine,
    web3Wrapper,
} from '../contracts';
import {
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    fetchAndPrintERC721Owner,
    printData,
    printScenario,
    printTransaction,
    awaitTransactionMinedSpinnerAsync,
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
    web3Wrapper.abiDecoder.addABI(dummyERC721TokenContract.abi);
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const maker = accounts[0];
    const taker = accounts[1];
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    // the amount the maker is selling in maker asset (1 ERC721 Token)
    const makerAssetAmount = new BigNumber(1);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    const tokenId = generatePseudoRandomSalt();
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetProxyUtils.encodeERC721AssetData(dummyERC721TokenContract.address, tokenId);
    const takerAssetData = assetProxyUtils.encodeERC20AssetData(etherTokenContract.address);
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
    txReceipt = await awaitTransactionMinedSpinnerAsync('Maker ERC721 Approval', makerERC721ApproveTxHash);

    // Approve the new ERC20 Proxy to move WETH for taker
    const takerWETHApproveTxHash = await etherTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: taker,
        },
    );
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApproveTxHash);

    // Deposit ETH into WETH for the taker
    const takerWETHDepositTxHash = await etherTokenContract.deposit.sendTransactionAsync({
        from: taker,
        value: takerAssetAmount,
    });
    txReceipt = await awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash);

    printData('Setup', [
        ['Mint ERC721', mintTxHash],
        ['Maker ERC721 Approval', makerERC721ApproveTxHash],
        ['Taker WETH Approval', takerWETHApproveTxHash],
        ['Taker WETH Deposit', takerWETHDepositTxHash],
    ]);

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
    await fetchAndPrintAllowancesAsync({ maker, taker }, [etherTokenContract], erc20ProxyAddress);
    await fetchAndPrintBalancesAsync({ maker, taker }, [dummyERC721TokenContract, etherTokenContract]);
    await fetchAndPrintERC721Owner({ maker, taker }, dummyERC721TokenContract, tokenId);

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

    txHash = await exchangeContract.fillOrder.sendTransactionAsync(order, takerAssetAmount, signature, {
        ...TX_DEFAULTS,
        from: taker,
    });
    txReceipt = await awaitTransactionMinedSpinnerAsync('fillOrder', txHash);
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
