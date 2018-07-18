import { ZeroEx } from '0x.js';
import { MessagePrefixType } from '@0xProject/order-utils';
import { Order, SignedOrder } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import { NULL_ADDRESS, TX_DEFAULTS, ZERO } from '../../constants';
import { signingUtils } from '../../signing_utils';
import { getKittyBackground, getKittyGen, getKittyImage } from './kittyData';
import { artifacts } from '../../artifacts';
import { DummyERC721TokenContract } from '../../contract_wrappers/dummy_erc721_token';

const tenMinutes = 10 * 60 * 1000;
const WETH_DECIMALS = 18;

export interface KittyData {
    background: string;
    image: string;
    price: string;
    gen: string;
    id: string;
    order: SignedOrder;
    orderHash: string;
}

export interface MintedKittyData extends KittyData {
    txHash: string;
}

export class KittyHelper {
    private owner: string;
    private erc721ContractAddress: string;
    private zeroEx: ZeroEx;
    private erc721TokenContract: DummyERC721TokenContract;
    constructor(owner: string, contractAddress: string, zeroEx: ZeroEx) {
        this.owner = owner;
        this.erc721ContractAddress = contractAddress;
        this.zeroEx = zeroEx;
        this.erc721TokenContract = new DummyERC721TokenContract(
            artifacts.DummyERC721Token.compilerOutput.abi,
            this.erc721ContractAddress,
            this.zeroEx.getProvider(),
        );
    }
    async createKittyOrderAsync(tokenId: BigNumber): Promise<SignedOrder> {
        const randomExpiration = new BigNumber(Date.now() + tenMinutes);
        // ERC721 tokens are always single, they are non-divisable
        const makerAssetAmount = new BigNumber(1);
        const price = (Math.round((Math.random() * 0.05 + 0.01) * 100) / 100).toString();
        // Set the cost in ETH for the ERC721 token
        const takerAssetAmount = ZeroEx.toBaseUnitAmount(new BigNumber(price), WETH_DECIMALS);
        // Encode in the order the ERC721 address and token id
        const makerAssetData = ZeroEx.encodeERC721AssetData(this.erc721ContractAddress, tokenId);
        // Encode in the order the ERC20 (WETH) address
        const etherTokenAddress = this.zeroEx.etherToken.getContractAddressIfExists();
        const takerAssetData = ZeroEx.encodeERC20AssetData(etherTokenAddress);
        // Create the order
        const exchangeAddress = this.zeroEx.exchange.getContractAddress();
        const order = {
            exchangeAddress: exchangeAddress,
            makerAddress: this.owner,
            takerAddress: NULL_ADDRESS, // This allows for ANY address to be the taker
            senderAddress: NULL_ADDRESS,
            feeRecipientAddress: NULL_ADDRESS, // No Fee Recipients on this order
            expirationTimeSeconds: randomExpiration,
            salt: ZeroEx.generatePseudoRandomSalt(),
            makerAssetAmount,
            takerAssetAmount,
            makerAssetData,
            takerAssetData,
            makerFee: ZERO, // No fees on this order
            takerFee: ZERO,
        } as Order;

        // Generate the Order Hash of the above order
        const orderHashHex = ZeroEx.getOrderHashHex(order);
        // The maker signs this order hash as a proof
        const ecSignature = await this.zeroEx.ecSignOrderHashAsync(orderHashHex, this.owner, {
            prefixType: MessagePrefixType.EthSign,
            shouldAddPrefixBeforeCallingEthSign: false,
        });
        const signature = signingUtils.rsvToSignature(ecSignature);
        // Construct a Signed order, an order with a signature
        const signedOrder = { ...order, signature };

        return signedOrder;
    }
    async mintKittyAsync(): Promise<MintedKittyData> {
        const id = new BigNumber(Math.floor(Math.random() * 9999999) + 1);
        // Mint this new kitty via the ERC721 token contract. This must be minted by owner
        const txHash = await this.erc721TokenContract.mint.sendTransactionAsync(this.owner, id, {
            ...TX_DEFAULTS,
            from: this.owner,
        });
        const order = await this.createKittyOrderAsync(new BigNumber(id));
        // Price of the Kitty is represented in WEI (18 Decimals)
        const price = ZeroEx.toUnitAmount(order.takerAssetAmount, WETH_DECIMALS).toString();
        const orderHash = ZeroEx.getOrderHashHex(order);
        return {
            background: getKittyBackground(id),
            image: getKittyImage(id),
            gen: getKittyGen(id).toString(),
            id: id.toString(),
            price,
            order,
            orderHash,
            txHash,
        };
    }
    /**
     * The owner of the token must set the approval to the 0x Exchange Proxy to enable exchange.
     */
    async setKittyMakerApprovalIfRequiredAsync(): Promise<string | undefined> {
        const isApproved = await this.zeroEx.erc721Token.isProxyApprovedForAllAsync(
            this.erc721ContractAddress,
            this.owner,
        );
        if (!isApproved) {
            const txHash = await this.zeroEx.erc721Token.setProxyApprovalForAllAsync(
                this.erc721ContractAddress,
                this.owner,
                true,
            );
            return txHash;
        }
        return undefined;
    }
}
