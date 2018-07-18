import { ZeroEx } from '0x.js';
import {
    MnemonicWalletSubprovider,
    RPCSubprovider,
    SignerSubprovider,
    Web3ProviderEngine,
} from '@0xproject/subproviders';
import { TransactionReceiptStatus } from 'ethereum-types';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { artifacts } from '../artifacts';
import { Box, Container } from 'bloomer';
import { BASE_DERIVATION_PATH, MNEMONIC, NETWORK_ID, NULL_ADDRESS, RPC_URL, TX_DEFAULTS } from '../constants';
import { buildContract, dummyERC721TokenContracts } from '../contracts';
import { ForwarderContract } from '../contract_wrappers/forwarder';
import { KittyData, KittyHelper } from './components/kittyHelper';
import { Marketplace } from './components/Marketplace';
import { Nav } from './components/Nav';

const e = React.createElement;

export interface BlockchainTransaction {
    txHash: string;
    status: TransactionReceiptStatus | undefined;
}

interface AppState {
    hasWeb3: boolean;
    providerEngine: Web3ProviderEngine;
    kittyData: KittyData[];
    forwarderContract: ForwarderContract | undefined;
    transactions: BlockchainTransaction[];
    zeroEx: ZeroEx;
    kittyHelper: KittyHelper;
    erc721TokenContractAddress: string;
}

const DEFAULT_POLLING_INTERVAL = 5000;
class App extends React.Component<{}, AppState> {
    constructor(props: {}) {
        super(props);
        const hasWeb3 = !!window.web3;
        const providerEngine = new Web3ProviderEngine({ pollingInterval: DEFAULT_POLLING_INTERVAL });
        // Grab the injected web3 provider and create a wrapper for Provider Engine
        // All signing and transaction based requests will be sent to this subprovider
        providerEngine.addProvider(new SignerSubprovider(window.web3.currentProvider));
        // Construc an RPC subprovider, all data based requests will be sent via the RPCSubprovider
        providerEngine.addProvider(new RPCSubprovider(RPC_URL));
        // Start the Provider Engine
        providerEngine.start();
        // Construct a ZeroEx instance with the above Provider Engine, pointing it to the selected Network
        const zeroEx = new ZeroEx(providerEngine, { networkId: NETWORK_ID });
        // Grab the deployed ERC721 token address
        const erc721TokenContractAddress = dummyERC721TokenContracts[0].address;
        this.state = {
            hasWeb3,
            zeroEx,
            providerEngine,
            erc721TokenContractAddress,
            kittyData: [],
            forwarderContract: undefined,
            kittyHelper: undefined,
            transactions: [],
        };
        void this.initializeAsync();
        void this.checkOrderStatusIntervalAsync();
    }
    /**
     * Build an instance of ZeroEx for the dev mnemonic. This is the owner of the deployed contracts and therefor
     * has the ability to mint new tokens.
     */
    buildMakerZeroEx = (): ZeroEx => {
        const makerProviderEngine = new Web3ProviderEngine({ pollingInterval: DEFAULT_POLLING_INTERVAL });
        const mnemonicWallet = new MnemonicWalletSubprovider({
            mnemonic: MNEMONIC,
            baseDerivationPath: BASE_DERIVATION_PATH,
        });
        makerProviderEngine.addProvider(mnemonicWallet);
        makerProviderEngine.addProvider(new RPCSubprovider(RPC_URL));
        makerProviderEngine.start();
        const makerZeroEx = new ZeroEx(makerProviderEngine, { networkId: NETWORK_ID });
        return makerZeroEx;
    }
    /**
     * Initialize the Marketplace
     * This constructs any helpers or required contracts not available via 0x.js
     */
    initializeAsync = async (): Promise<void> => {
        const { providerEngine, erc721TokenContractAddress } = this.state;
        // Build the forwarder contract for this network and for this user (injected web3)
        const forwarderContract = buildContract<ForwarderContract>(
            ForwarderContract,
            NETWORK_ID,
            artifacts.Forwarder,
            providerEngine,
        );
        // The owner of the ERC721 Token contracts is the 0x Dev account
        // We construct a special ZeroEx instance to handle any minting operations
        const makerZeroEx = this.buildMakerZeroEx();
        const [owner] = await makerZeroEx.getAvailableAddressesAsync();
        const kittyHelper = new KittyHelper(owner, erc721TokenContractAddress, makerZeroEx);
        this.setState(prevState => {
            return { ...prevState, forwarderContract, kittyHelper };
        });
        // Initializes the 0x dev account to exchange any minted kitties
        const approvalTxHash = await kittyHelper.setKittyMakerApprovalIfRequiredAsync();
        if (approvalTxHash) {
            this.onTransactionSubmittedAsync({ txHash: approvalTxHash, status: undefined });
        }
        // Mint a kitty via the 0x dev account
        await this.mintKittyAsync();
    }
    onTransactionSubmittedAsync = async (tx: BlockchainTransaction) => {
        const { zeroEx, transactions } = this.state;
        // Add the pending transaction to the transactions list
        this.setState(prevState => {
            return { ...prevState, transactions: [tx, ...prevState.transactions] };
        });
        // Await the transaction being mined
        const txReceipt = await zeroEx.awaitTransactionMinedAsync(tx.txHash);
        tx.status = txReceipt.status;
        const remainingTx = transactions.filter(t => t.txHash !== tx.txHash);
        // Update the transaction list with the status of the mined transaction
        this.setState(prevState => {
            return { ...prevState, transactions: [tx, ...remainingTx] };
        });
    }
    mintKittyAsync = async (): Promise<void> => {
        const { kittyHelper } = this.state;
        const kitty = await kittyHelper.mintKittyAsync();
        this.onTransactionSubmittedAsync({ txHash: kitty.txHash, status: undefined });
        // Add the kitty to the list of kitties in the marketplace
        this.setState(prevState => {
            return { ...prevState, kittyData: [...prevState.kittyData, kitty] };
        });
    }
    /**
     * Periodically check all of the kitty data, removing any kitties which are no longer FILLABLE.
     * This could due to a fill, cancel or order expiry
     */
    checkOrderStatusIntervalAsync = async (): Promise<void> => {
        setInterval(async () => {
            const { zeroEx, kittyData } = this.state;
            for (const kitty of kittyData) {
                // Request the state of the order from the Exchange contract
                const orderInfo = await zeroEx.exchange.getOrderInfoAsync(kitty.order);
                // Order Status 3 is FILLABLE, there are other states such as FILLED, CANCELLED, EXPIRED
                if (orderInfo.orderStatus !== 3) {
                    // This order is no longer FILLABLE, remove it from the Marketplace listing
                    const remainingKitties = kittyData.filter(k => k !== kitty);
                    this.setState(prevState => {
                        return { ...prevState, kittyData: [...remainingKitties] };
                    });
                }
            }
        },          DEFAULT_POLLING_INTERVAL);
    }
    /**
     * Here we buy the kitty via the forwarding contract.
     */
    onBuyKitty = async (kitty: KittyData): Promise<void> => {
        const { zeroEx, forwarderContract } = this.state;
        if (forwarderContract) {
            // Taker is the first address in the available addresses
            const [taker] = await zeroEx.getAvailableAddressesAsync();
            const order = kitty.order;
            // Fee proportion allows additional ETH to be deducted from the Taker and sent to the Fee Recipient
            const feePropotion = 0;
            // Fee Recipient is a received of feeProportion amount
            const feeRecipient = NULL_ADDRESS;
            const feeOrders = [];
            const feeSignatures = [];
            // Submit the order via the forwarding contract
            // Allowing the taker to buy the ERC721 token with ETH
            const txHash = await forwarderContract.marketBuyTokensWithEth.sendTransactionAsync(
                [order], // The forwarding contract supports an array of orders, we use one here
                [order.signature],
                feeOrders,
                feeSignatures,
                order.makerAssetAmount,
                feePropotion,
                feeRecipient,
                {
                    ...TX_DEFAULTS,
                    from: taker, // Send this from the taker account
                    value: order.takerAssetAmount, // Attach the required amount of ETH to the transaction
                },
            );
            const transaction = { txHash, status: undefined };
            this.onTransactionSubmittedAsync(transaction);
        }
    }
    render() {
        if (!this.state.hasWeb3) {
            return (
                <Container style={{ marginTop: '50px' }}>
                    <Box>
                        Please install <a href="https://metamask.io/"> Metamask</a>
                    </Box>
                </Container>
            );
        }

        return (
            <div>
                <Nav mint={this.mintKittyAsync} transactions={this.state.transactions} />
                <Container>
                    <Marketplace kittyData={this.state.kittyData} onBuyKitty={this.onBuyKitty} />
                </Container>
            </div>
        );
    }
}

// main
const main = document.getElementById('js-main');
if (main) {
    ReactDOM.render(e(App), main);
}
