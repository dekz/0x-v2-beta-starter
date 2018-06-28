import { SignatureType } from '@0xproject/types';
import * as ethUtil from 'ethereumjs-util';
import { MnemonicWalletSubprovider } from '@0xproject/subproviders';

export const signingUtils = {
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
};
