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
import { NETWORK_ID } from '../constants';
import { providerEngine } from '../contracts';
import { fetchAndPrintContractBalancesAsync, printData } from '../print_utils';

(async () => {
    const contractWrappers = new ContractWrappers(providerEngine, { networkId: NETWORK_ID });
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [maker, taker] = await web3Wrapper.getAvailableAddressesAsync();
    printData('Accounts', [['Maker', maker], ['Taker', taker]]);
    const etherTokenAddress = contractWrappers.etherToken.getContractAddressIfExists();
    const zrxTokenAddress = contractWrappers.exchange.getZRXTokenAddress();
    await fetchAndPrintContractBalancesAsync(
        { maker, taker },
        { ZRX: zrxTokenAddress, WETH: etherTokenAddress },
        contractWrappers.erc20Token,
    );

    console.log('');
    const exchangeAddress = contractWrappers.exchange.getContractAddress();

    const erc20ProxyId = await contractWrappers.erc20Proxy.getProxyIdAsync();
    const erc721ProxyId = await contractWrappers.erc721Proxy.getProxyIdAsync();
    const erc20AssetProxyResult = await contractWrappers.exchange.getAssetProxyBySignatureAsync(erc20ProxyId);
    const erc721AssetProxyResult = await contractWrappers.exchange.getAssetProxyBySignatureAsync(erc721ProxyId);
    printData('Exchange', [
        ['address', exchangeAddress],
        ['erc20Proxy', erc20AssetProxyResult],
        ['erc721Proxy', erc721AssetProxyResult],
    ]);

    const erc20ProxyAuthorisedAddresses = await contractWrappers.erc20Proxy.getAuthorizedAddressesAsync();
    const erc20ProxyAddress = contractWrappers.erc20Proxy.getContractAddress();
    const erc721ProxyAddress = contractWrappers.erc721Proxy.getContractAddress();
    const erc721ProxyAuthorisedAddresses = await contractWrappers.erc721Proxy.getAuthorizedAddressesAsync();
    printData('ERC20 Proxy', [['address', erc20ProxyAddress], ['authorised', erc20ProxyAuthorisedAddresses.join(',')]]);
    printData('ERC721 Proxy', [
        ['address', erc721ProxyAddress],
        ['authorised', erc721ProxyAuthorisedAddresses.join(',')],
    ]);

    providerEngine.stop();
})();
