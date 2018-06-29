// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetProxyUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xProject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import { NULL_ADDRESS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import {
    erc20ProxyAddress,
    erc20ProxyContract,
    erc721ProxyAddress,
    etherTokenContract,
    exchangeContract,
    zrxTokenContract,
    providerEngine,
    mnemonicWallet,
    erc721ProxyContract,
} from '../contracts';
import { signingUtils } from '../signing_utils';

const web3Wrapper = new Web3Wrapper(providerEngine);
(async () => {
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const makerAccount = accounts[0];
    const takerAccount = accounts[1];
    console.log('makerAccount', makerAccount);
    console.log('takerAccount', takerAccount);

    // Print out the Balances and Allowances
    const makerZRXBalance = await zrxTokenContract.balanceOf.callAsync(makerAccount);
    const makerZRXERC20ProxyAllowance = await zrxTokenContract.allowance.callAsync(makerAccount, erc20ProxyAddress);
    const takerWETHBalance = await etherTokenContract.balanceOf.callAsync(takerAccount);
    const takerWETHERC20ProxyAllowance = await etherTokenContract.allowance.callAsync(takerAccount, erc20ProxyAddress);
    console.log('makerZRXBalance', makerZRXBalance.toString());
    console.log('makerZRXERC20ProxyAllowance', makerZRXERC20ProxyAllowance.toString());
    console.log('takerWETHBalance', takerWETHBalance.toString());
    console.log('takerWETHERC20ProxyAllowance', takerWETHERC20ProxyAllowance.toString());

    console.log('');
    const exchangeAddress = await exchangeContract.address;
    console.log('exchangeAddress', exchangeAddress);

    const exchangeOwner = await exchangeContract.owner.callAsync();
    console.log('exchangeOwner', exchangeOwner);

    console.log('');
    console.log('ERC20 Proxy');
    const erc20ProxyId = await erc20ProxyContract.getProxyId.callAsync();
    console.log('erc20ProxyId', erc20ProxyId);
    console.log('erc20ProxyAddress', erc20ProxyAddress);
    const erc20AssetProxyResult = await exchangeContract.assetProxies.callAsync(erc20ProxyId);
    console.log('exchange ERC20 Proxy', erc20AssetProxyResult);
    const erc20ProxyAuthorisedAddresses = await erc20ProxyContract.getAuthorizedAddresses.callAsync();
    console.log('erc20ProxyAuthorisedAddresses', erc20ProxyAuthorisedAddresses);
    let txHash;

    console.log('');
    console.log('ERC721 Proxy');
    const erc721ProxyId = await erc721ProxyContract.getProxyId.callAsync();
    console.log('erc721ProxyId', erc721ProxyId);
    console.log('erc721ProxyAddress', erc721ProxyAddress);
    const erc721AssetProxyResult = await exchangeContract.assetProxies.callAsync(erc721ProxyId);
    console.log('exchange ERC721 Proxy', erc721AssetProxyResult);
    const erc721ProxyAuthorisedAddresses = await erc721ProxyContract.getAuthorizedAddresses.callAsync();
    console.log('erc721ProxyAuthorisedAddresses', erc721ProxyAuthorisedAddresses);

    providerEngine.stop();
})();
