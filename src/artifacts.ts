import { ContractArtifact } from '@0xproject/sol-compiler';

import * as Exchange from './artifacts/Exchange.json';
import * as Forwarder from './artifacts/Forwarder.json';
import * as DummyERC20Token from './artifacts/DummyERC20Token.json';
import * as DummyERC721Token from './artifacts/DummyERC721Token.json';
import * as ZRX from './artifacts/ZRXToken.json';

export const artifacts = {
    Exchange: (Exchange as any) as ContractArtifact,
    Forwarder: (Forwarder as any) as ContractArtifact,
    DummyERC20Token: (DummyERC20Token as any) as ContractArtifact,
    DummyERC721Token: (DummyERC721Token as any) as ContractArtifact,
    ZRX: (ZRX as any) as ContractArtifact,
};
