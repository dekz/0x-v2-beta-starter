// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { MnemonicWalletSubprovider } from '@0xproject/subproviders';
import { artifacts } from './artifacts';
import { BASE_DERIVATION_PATH, NETWORK_ID, RPC_URL, MNEMONIC, GANACHE_NETWORK_ID } from './constants';
import { ExchangeContract } from './contract_wrappers/exchange';
import { WETH9Contract } from './contract_wrappers/weth9';
import { ZRXTokenContract } from './contract_wrappers/zrx_token';
import { ERC20ProxyContract } from './contract_wrappers/e_r_c20_proxy';
import { DummyERC20TokenContract } from './contract_wrappers/dummy_e_r_c20_token';
import { DummyERC721TokenContract } from './contract_wrappers/dummy_e_r_c721_token';

const Web3ProviderEngine = require('web3-provider-engine');
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc');

export const mnemonicWallet = new MnemonicWalletSubprovider({
    mnemonic: MNEMONIC,
    baseDerivationPath: BASE_DERIVATION_PATH,
});

export const providerEngine = new Web3ProviderEngine();
providerEngine.addProvider(mnemonicWallet);
providerEngine.addProvider(new RpcSubprovider({ rpcUrl: RPC_URL }));
providerEngine.start();

// Extract the Proxy addresses
export const erc721ProxyAddress = artifacts.ERC721Proxy.networks[NETWORK_ID].address;
export const erc20ProxyAddress = artifacts.ERC20Proxy.networks[NETWORK_ID].address;

// Create an Exchange Contract from the artifact output
export const exchangeContract = new ExchangeContract(
    artifacts.Exchange.compilerOutput.abi,
    artifacts.Exchange.networks[NETWORK_ID].address,
    providerEngine,
);

// Create an ZRX Token Contract from the artifact output
export const zrxTokenContract = new ZRXTokenContract(
    artifacts.ZRX.compilerOutput.abi,
    artifacts.ZRX.networks[NETWORK_ID].address,
    providerEngine,
);

// Create an WETH Token Contract from the artifact output
export const etherTokenContract = new WETH9Contract(
    artifacts.EtherToken.compilerOutput.abi,
    artifacts.EtherToken.networks[NETWORK_ID].address,
    providerEngine,
);

export const erc20ProxyContract = new ERC20ProxyContract(
    artifacts.ERC20Proxy.compilerOutput.abi,
    artifacts.ERC20Proxy.networks[NETWORK_ID].address,
    providerEngine,
);

export const erc721ProxyContract = new ERC20ProxyContract(
    artifacts.ERC721Proxy.compilerOutput.abi,
    artifacts.ERC721Proxy.networks[NETWORK_ID].address,
    providerEngine,
);

// These are only deployed on Ganache
export const dummyERC20TokenContracts: DummyERC20TokenContract[] = [];
export const dummyERC721TokenContracts: DummyERC721TokenContract[] = [];
const GANACHE_ERC20_TOKENS = [
    '0x6dfff22588be9b3ef8cf0ad6dc9b84796f9fb45f',
    '0xcfc18cec799fbd1793b5c43e773c98d4d61cc2db',
    '0xf22469f31527adc53284441bae1665a7b9214dba',
    '0x10add991de718a69dec2117cb6aa28098836511b',
    '0x8d61158a366019ac78db4149d75fff9dda51160d',
];
const GANACHE_ERC721_TOKENS = ['0x131855dda0aaff096f6854854c55a4debf61077a'];
if (NETWORK_ID === GANACHE_NETWORK_ID) {
    for (const tokenAddress of GANACHE_ERC20_TOKENS) {
        dummyERC20TokenContracts.push(
            new DummyERC20TokenContract(artifacts.DummyERC20Token.compilerOutput.abi, tokenAddress, providerEngine),
        );
    }
    for (const tokenAddress of GANACHE_ERC721_TOKENS) {
        dummyERC721TokenContracts.push(
            new DummyERC721TokenContract(artifacts.DummyERC721Token.compilerOutput.abi, tokenAddress, providerEngine),
        );
    }
}
