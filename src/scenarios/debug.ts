// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { assetDataUtils, generatePseudoRandomSalt, orderHashUtils } from '@0xProject/order-utils';
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
    web3Wrapper,
} from '../contracts';
import { signingUtils } from '../signing_utils';
import { printData, fetchAndPrintBalancesAsync } from '../print_utils';

(async () => {
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const maker = accounts[0];
    const taker = accounts[1];
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);

    await fetchAndPrintBalancesAsync({ maker, taker }, [zrxTokenContract, etherTokenContract]);
    console.log('');

    const exchangeOwner = await exchangeContract.owner.callAsync();
    const erc20ProxyId = await erc20ProxyContract.getProxyId.callAsync();
    const erc721ProxyId = await erc721ProxyContract.getProxyId.callAsync();
    const erc20AssetProxyResult = await exchangeContract.assetProxies.callAsync(erc20ProxyId);
    const erc721AssetProxyResult = await exchangeContract.assetProxies.callAsync(erc721ProxyId);
    printData('Exchange', [
        ['address', exchangeContract.address],
        ['owner', exchangeOwner],
        ['erc20Proxy', erc20AssetProxyResult],
        ['erc721Proxy', erc721AssetProxyResult],
    ]);

    const erc20ProxyAuthorisedAddresses = await erc20ProxyContract.getAuthorizedAddresses.callAsync();
    const erc721ProxyAuthorisedAddresses = await erc721ProxyContract.getAuthorizedAddresses.callAsync();
    printData('ERC20 Proxy', [['address', erc20ProxyAddress], ['authorised', erc20ProxyAuthorisedAddresses.join(',')]]);
    printData('ERC721 Proxy', [
        ['address', erc721ProxyAddress],
        ['authorised', erc721ProxyAuthorisedAddresses.join(',')],
    ]);

    providerEngine.stop();
})();
