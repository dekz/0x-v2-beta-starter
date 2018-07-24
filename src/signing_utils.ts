import { SignatureType } from '@0xproject/types';
import * as ethUtil from 'ethereumjs-util';
import { MnemonicWalletSubprovider } from '@0xproject/subproviders';
import { EIP712Utils, EIP712Schema, EIP712Types } from '@0xproject/order-utils';
import { BigNumber } from '@0xproject/utils';

const EIP712_ZEROEX_TRANSACTION_SCHEMA: EIP712Schema = {
    name: 'ZeroExTransaction',
    parameters: [
        { name: 'salt', type: EIP712Types.Uint256 },
        { name: 'signerAddress', type: EIP712Types.Address },
        { name: 'data', type: EIP712Types.Bytes },
    ],
};

export const signingUtils = {
    rsvToSignature(ecSignature: ECSignature): string {
        const signatureBuffer = Buffer.concat([
            ethUtil.toBuffer(ecSignature.v),
            ethUtil.toBuffer(ecSignature.r),
            ethUtil.toBuffer(ecSignature.s),
            ethUtil.toBuffer(SignatureType.EthSign),
        ]);
        const signature = `0x${signatureBuffer.toString('hex')}`;
        return signature;
    },
    async signMessageAsync(
        message: Buffer,
        address: string,
        mnemonicWallet: MnemonicWalletSubprovider,
        signatureType: SignatureType,
    ): Promise<Buffer> {
        if (signatureType === SignatureType.EthSign) {
            const signatureHex = await mnemonicWallet.signPersonalMessageAsync(ethUtil.bufferToHex(message), address);
            const rpcSig = ethUtil.fromRpcSig(signatureHex);
            const signature = Buffer.concat([
                ethUtil.toBuffer(rpcSig.v),
                rpcSig.r,
                rpcSig.s,
                ethUtil.toBuffer(signatureType),
            ]);
            return signature;
        } else {
            throw new Error(`${signatureType} is not a valid signature type`);
        }
    },
    getExecuteTransactionHex(data: string, salt: BigNumber, signerAddress: string, exchangeAddress: string): string {
        const executeTransactionData = {
            salt,
            signerAddress,
            data,
        };
        const executeTransactionHashBuff = EIP712Utils.structHash(
            EIP712_ZEROEX_TRANSACTION_SCHEMA,
            executeTransactionData,
        );
        const eip721MessageBuffer = EIP712Utils.createEIP712Message(executeTransactionHashBuff, exchangeAddress);
        const messageHex = `0x${eip721MessageBuffer.toString('hex')}`;
        return messageHex;
    },
    async signExecuteTransactionHexAsync(
        executeTransactionHex: string,
        signerAddress: string,
        mnemonicWallet: MnemonicWalletSubprovider,
        signatureType: SignatureType = SignatureType.EthSign,
    ): Promise<string> {
        const eip721MessageBuffer = ethUtil.toBuffer(executeTransactionHex);
        const signature = await signingUtils.signMessageAsync(
            eip721MessageBuffer,
            signerAddress,
            mnemonicWallet,
            signatureType,
        );
        const signatureHex = `0x${signature.toString('hex')}`;
        return signatureHex;
    },
};
