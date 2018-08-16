import { ZeroEx } from '0x.js';
import { NETWORK_ID } from '../constants';
import { providerEngine, zrxTokenAddress } from '../contracts';
import { fetchAndPrintContractBalancesAsync, printData } from '../print_utils';

(async () => {
    const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
    const [maker, taker] = await zeroEx.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);
    const etherTokenAddress = zeroEx.etherToken.getContractAddressIfExists();
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        zeroEx,
    );

    console.log('');
    const exchangeAddress = zeroEx.exchange.getContractAddress();

    const erc20ProxyId = await zeroEx.erc20Proxy.getProxyIdAsync();
    const erc721ProxyId = await zeroEx.erc721Proxy.getProxyIdAsync();
    const erc20AssetProxyResult = await zeroEx.exchange.getAssetProxyBySignatureAsync(erc20ProxyId);
    const erc721AssetProxyResult = await zeroEx.exchange.getAssetProxyBySignatureAsync(erc721ProxyId);
    printData('Exchange', [
        ['address', exchangeAddress],
        ['erc20Proxy', erc20AssetProxyResult],
        ['erc721Proxy', erc721AssetProxyResult],
    ]);

    const erc20ProxyAuthorisedAddresses = await zeroEx.erc20Proxy.getAuthorizedAddressesAsync();
    const erc20ProxyAddress = zeroEx.erc20Proxy.getContractAddress();
    const erc721ProxyAddress = zeroEx.erc721Proxy.getContractAddress();
    const erc721ProxyAuthorisedAddresses = await zeroEx.erc721Proxy.getAuthorizedAddressesAsync();
    printData('ERC20 Proxy', [['address', erc20ProxyAddress], ['authorised', erc20ProxyAuthorisedAddresses.join(',')]]);
    printData('ERC721 Proxy', [
        ['address', erc721ProxyAddress],
        ['authorised', erc721ProxyAuthorisedAddresses.join(',')],
    ]);

    providerEngine.stop();
})();
