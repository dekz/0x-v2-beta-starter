// Ensure you have linked the latest source via yarn link and are not pulling from NPM for the packages
import { BigNumber } from '@0xproject/utils';
import {
    etherTokenContract,
    providerEngine,
    dummyERC20TokenContracts,
    dummyERC721TokenContracts,
    web3Wrapper,
} from '../contracts';
import {
    fetchAndPrintAllowancesAsync,
    fetchAndPrintBalancesAsync,
    printData,
    printScenario,
    printTransaction,
    awaitTransactionMinedSpinnerAsync,
} from '../print_utils';
import { ContractArtifact } from '@0xproject/sol-compiler';
import * as HelloArtifact from '../artifacts/Hello.json';
const HelloContractArtifact = (HelloArtifact as any) as ContractArtifact;
import { HelloContract } from '../contract_wrappers/hello';

export async function scenario() {
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    const owner = accounts[0];
    // Deploy the Hello Contract
    const hello = await HelloContract.deployFrom0xArtifactAsync(HelloContractArtifact, providerEngine, { from: owner });
    // Insantiate the new Hello Contract via the contract wrapper
    const helloContract = new HelloContract(HelloContractArtifact.compilerOutput.abi, hello.address, providerEngine);
    // Construct the query for the hello example, fetch all user balances for the respective tokens
    const query = dummyERC20TokenContracts.map(token => {
        return { contractAddress: token.address, userAddresses: accounts };
    });
    // Query the blockchain for the data
    console.time('batch fetch balances');
    const batchBalances = await helloContract.batchQueryBalances.callAsync(query);
    console.timeEnd('batch fetch balances');

    printData('Balances', batchBalances as any);
    console.time('fetch balances');
    const allBalances = [];
    for (const contract of dummyERC20TokenContracts) {
        const contractBalances = await Promise.all(accounts.map(address => contract.balanceOf.callAsync(address)));
        allBalances.push(contractBalances);
    }
    console.timeEnd('fetch balances');
    printData('Balances', allBalances as any);
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
