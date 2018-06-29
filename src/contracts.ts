// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { MnemonicWalletSubprovider } from '@0xproject/subproviders';
import { artifacts } from './artifacts';
import { BASE_DERIVATION_PATH, NETWORK_ID, RPC_URL, MNEMONIC } from './constants';
import { ExchangeContract } from './contract_wrappers/exchange';
import { WETH9Contract } from './contract_wrappers/weth9';
import { ZRXTokenContract } from './contract_wrappers/zrx_token';
import { ERC20ProxyContract } from './contract_wrappers/e_r_c20_proxy';

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
