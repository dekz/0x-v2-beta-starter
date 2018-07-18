import {
    Button,
    Control,
    Field,
    Icon,
    Navbar,
    NavbarBrand,
    NavbarEnd,
    NavbarItem,
    NavbarMenu,
    Image,
    NavbarDropdown,
    NavbarLink,
} from 'bloomer';
import * as React from 'react';
import { BlockchainTransaction } from '..';

interface NavState {
    isActive: boolean;
}
interface NavProps {
    mint: () => void;
    transactions: BlockchainTransaction[];
}
export class Nav extends React.Component<NavProps, NavState> {
    constructor(props: NavProps) {
        super(props);
        this.state = { isActive: false };
    }
    render() {
        const { transactions } = this.props;
        let isLoading = false;
        if (transactions) {
            isLoading = transactions.some(tx => tx.status === undefined);
        }
        const transactionsButton = isLoading ? (
            <Button isLoading={isLoading} isColor="white" />
        ) : (
            <Button isColor="white">
                <Icon style={{ paddingTop: '5px' }} className="fa fa-info-circle" />
            </Button>
        );

        const transactionsListRender = (
            <NavbarDropdown className="is-right">
                {transactions.map(tx => {
                    const txPending = tx.status === undefined;
                    const transactionRender = txPending ? (
                        <NavbarItem key={tx.txHash} href="#/">
                            <Button isLoading={isLoading} isColor="white" /> {tx.txHash}
                        </NavbarItem>
                    ) : (
                        <NavbarItem key={tx.txHash} href="#/">
                            {tx.txHash}
                        </NavbarItem>
                    );
                    return transactionRender;
                })}
            </NavbarDropdown>
        );
        const transactionsMenu = (
            <NavbarItem hasDropdown={true} isHoverable={true}>
                <NavbarLink href="#">{transactionsButton}</NavbarLink>
                {transactionsListRender}
            </NavbarItem>
        );
        return (
            <Navbar style={{ margin: '0', marginBottom: '50px' }}>
                <NavbarBrand>
                    <NavbarItem>
                        <Image
                            isSize="16x16"
                            src="https://0xproject.com/images/favicon/favicon-2-32x32.png"
                            style={{ marginRight: '10px' }}
                        />
                        <strong> 0x Marketplace </strong>
                    </NavbarItem>
                </NavbarBrand>
                <NavbarMenu isActive={this.state.isActive}>
                    <NavbarEnd>
                        {transactionsMenu}
                        <NavbarItem>
                            <Field isGrouped={true}>
                                <Control>
                                    <Button onClick={this.props.mint}>
                                        <span>Mint</span>
                                    </Button>
                                </Control>
                            </Field>
                        </NavbarItem>
                    </NavbarEnd>
                </NavbarMenu>
            </Navbar>
        );
    }
}
