// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { MnemonicWalletSubprovider } from '@0xproject/subproviders';
import { artifacts } from './artifacts';
import { BASE_DERIVATION_PATH, KOVAN_NETWORK_ID, KOVAN_RPC, MNEMONIC } from './constants';
import { ExchangeContract } from './contract_wrappers/exchange';
import { WETH9Contract } from './contract_wrappers/weth9';
import { ZRXTokenContract } from './contract_wrappers/zrx_token';

const Web3ProviderEngine = require('web3-provider-engine');
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc');

export const mnemonicWallet = new MnemonicWalletSubprovider({
    mnemonic: MNEMONIC,
    baseDerivationPath: BASE_DERIVATION_PATH,
});
export const providerEngine = new Web3ProviderEngine();
providerEngine.addProvider(mnemonicWallet);
providerEngine.addProvider(new RpcSubprovider({ rpcUrl: KOVAN_RPC }));
providerEngine.start();

// Extract the Proxy addresses
export const erc721ProxyAddress = artifacts.ERC721Proxy.networks[KOVAN_NETWORK_ID].address;
export const erc20ProxyAddress = artifacts.ERC20Proxy.networks[KOVAN_NETWORK_ID].address;

// Create an Exchange Contract from the artifact output
export const exchangeContract = new ExchangeContract(
    artifacts.Exchange.compilerOutput.abi,
    artifacts.Exchange.networks[KOVAN_NETWORK_ID].address,
    providerEngine,
);

// Create an ZRX Token Contract from the artifact output
export const zrxTokenContract = new ZRXTokenContract(
    artifacts.ZRX.compilerOutput.abi,
    artifacts.ZRX.networks[KOVAN_NETWORK_ID].address,
    providerEngine,
);

// Create an WETH Token Contract from the artifact output
export const etherTokenContract = new WETH9Contract(
    artifacts.EtherToken.compilerOutput.abi,
    artifacts.EtherToken.networks[KOVAN_NETWORK_ID].address,
    providerEngine,
);
