// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetProxyUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xProject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import { NULL_ADDRESS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import {
    erc20ProxyAddress,
    etherTokenContract,
    exchangeContract,
    zrxTokenContract,
    providerEngine,
    mnemonicWallet,
} from '../contracts';
import { signingUtils } from '../signing_utils';

const web3Wrapper = new Web3Wrapper(providerEngine);
(async () => {
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const makerAccount = accounts[0];
    const takerAccount = accounts[1];
    console.log('makerAccount', makerAccount);
    console.log('takerAccount', takerAccount);
    // the amount the maker is selling in maker asset
    const makerAssetAmount = new BigNumber(100);
    // the amount the maker is wanting in taker asset
    const takerAssetAmount = new BigNumber(10);
    // 0x v2 uses asset data to encode the correct proxy type and additional parameters
    const makerAssetData = assetProxyUtils.encodeERC20AssetData(zrxTokenContract.address);
    const takerAssetData = assetProxyUtils.encodeERC20AssetData(etherTokenContract.address);
    let txHash;
    let txReceipt;

    // Approve the new ERC20 Proxy to move ZRX for makerAccount
    txHash = await zrxTokenContract.approve.sendTransactionAsync(erc20ProxyAddress, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, {
        from: makerAccount,
    });
    console.log('makerAccount ZRX approval of ERC20 Proxy txHash:', txHash);
    txReceipt = await web3Wrapper.awaitTransactionMinedAsync(txHash);

    // Approve the new ERC20 Proxy to move WETH for takerAccount
    txHash = await etherTokenContract.approve.sendTransactionAsync(
        erc20ProxyAddress,
        UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
        {
            from: takerAccount,
        },
    );
    console.log('takerAccount WETH approval of ERC20 Proxy txHash:', txHash);
    txReceipt = await web3Wrapper.awaitTransactionMinedAsync(txHash);

    // Deposit ETH into WETH for the taker
    txHash = await etherTokenContract.deposit.sendTransactionAsync({ from: takerAccount, value: takerAssetAmount });
    console.log('WETH deposit txHash:', txHash);
    txReceipt = await web3Wrapper.awaitTransactionMinedAsync(txHash);

    // Print out the Balances and Allowances
    const makerZRXBalance = await zrxTokenContract.balanceOf.callAsync(makerAccount);
    const makerZRXERC20ProxyAllowance = await zrxTokenContract.allowance.callAsync(makerAccount, erc20ProxyAddress);
    const takerWETHBalance = await etherTokenContract.balanceOf.callAsync(takerAccount);
    const takerWETHERC20ProxyAllowance = await etherTokenContract.allowance.callAsync(takerAccount, erc20ProxyAddress);
    console.log('makerZRXBalance', makerZRXBalance.toString());
    console.log('makerZRXERC20ProxyAllowance', makerZRXERC20ProxyAllowance.toString());
    console.log('takerWETHBalance', takerWETHBalance.toString());
    console.log('takerWETHERC20ProxyAllowance', takerWETHERC20ProxyAllowance.toString());

    // Set up the Order and fill it
    const tenMinutes = 10 * 60 * 1000;
    const randomExpiration = new BigNumber(Date.now() + tenMinutes);

    // Create the order
    const order = {
        exchangeAddress: exchangeContract.address,
        makerAddress: makerAccount,
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

    // Create the order hash
    const orderHashBuffer = orderHashUtils.getOrderHashBuffer(order);
    const orderHashHex = `0x${orderHashBuffer.toString('hex')}`;
    const signatureBuffer = await signingUtils.signMessageAsync(
        orderHashBuffer,
        makerAccount,
        mnemonicWallet,
        SignatureType.EthSign,
    );
    const signature = `0x${signatureBuffer.toString('hex')}`;

    // Check that the signature is valid via the Exchange contract
    const isValidSignature = await exchangeContract.isValidSignature.callAsync(orderHashHex, makerAccount, signature);
    console.log('isValidSignature', isValidSignature);

    // Fill the Order from takerAccount
    txHash = await exchangeContract.fillOrder.sendTransactionAsync(order, takerAssetAmount, signature, {
        from: takerAccount,
    });
    console.log('fillOrder txHash:', txHash);
    txReceipt = await web3Wrapper.awaitTransactionMinedAsync(txHash);
    providerEngine.stop();
})();
