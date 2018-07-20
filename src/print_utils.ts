import { ZeroEx } from '0x.js';
import { UNLIMITED_ALLOWANCE_IN_BASE_UNITS } from './constants';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';
import { BigNumber } from '@0xproject/utils';
import ora = require('ora');

const Table = require('cli-table');
const EMPTY_DATA = [];

const erc721IconRaw = [
    '    ____  ',
    '  .X +.    .',
    '.Xx + -.     .',
    'XXx++ -..      ',
    'XXxx++--..    ',
    ` XXXxx+++--  `,
    "  XXXxxx'     ",
    '     ""     ',
];
const erc721Icon = erc721IconRaw.join('\n');

const defaultSchema = {
    style: {
        head: ['green'],
    },
};

const borderlessSchema = {
    ...defaultSchema,
    chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: ' ',
    },
    style: { 'padding-left': 1, 'padding-right': 0, head: ['blue'] },
};

const dataSchema = {
    ...borderlessSchema,
    style: { 'padding-left': 1, 'padding-right': 0, head: ['yellow'] },
};

function pushAndPrint(table: any, tableData: string[][]): void {
    for (const col of tableData) {
        for (const i in col) {
            if (col[i] === UNLIMITED_ALLOWANCE_IN_BASE_UNITS.toString()) {
                col[i] = 'MAX_UINT';
            }
        }
        table.push(col);
    }
    console.log(table.toString());
}

export function printHeader(header: string): void {
    const table = new Table({
        ...borderlessSchema,
        style: { 'padding-left': 0, 'padding-right': 0, head: ['blue'] },
        head: [header],
    });
    console.log('');
    pushAndPrint(table, EMPTY_DATA);
}

export function printScenario(header: string): void {
    const table = new Table({
        ...defaultSchema,
        head: [header],
    });
    pushAndPrint(table, EMPTY_DATA);
}

export function printData(header: string, tableData: string[][]): void {
    const table = new Table({
        ...dataSchema,
        head: [header, ''],
    });
    pushAndPrint(table, tableData);
}

export async function fetchAndPrintBalancesAsync(accountDetails: {}, contracts: any[]): Promise<void> {
    const flattenedBalances = [];
    const flattenedAccounts = Object.keys(accountDetails).map(
        account => account.charAt(0).toUpperCase() + account.slice(1),
    );
    for (const token of contracts) {
        const tokenSymbol = await token.symbol.callAsync();
        const balances = [tokenSymbol];
        for (const account in accountDetails) {
            const address = accountDetails[account];
            const balance = await token.balanceOf.callAsync(address);
            balances.push(balance.toString());
        }
        flattenedBalances.push(balances);
    }
    const table = new Table({
        ...dataSchema,
        head: ['Token', ...flattenedAccounts],
    });
    printHeader('Balances');
    pushAndPrint(table, flattenedBalances);
}

export async function fetchAndPrintERC721Owner(
    accountDetails: {},
    erc721Contract: any,
    tokenId: BigNumber,
): Promise<void> {
    const flattenedBalances = [];
    const flattenedAccounts = Object.keys(accountDetails).map(
        account => account.charAt(0).toUpperCase() + account.slice(1),
    );
    const tokenSymbol = await erc721Contract.symbol.callAsync();
    const balances = [tokenSymbol];
    const owner = await erc721Contract.ownerOf.callAsync(tokenId);
    for (const account in accountDetails) {
        const address = accountDetails[account];
        const balance = owner === address ? erc721Icon : '';
        balances.push(balance);
    }
    flattenedBalances.push(balances);
    const table = new Table({
        ...dataSchema,
        head: ['Token', ...flattenedAccounts],
    });
    printHeader('ERC721 Owner');
    pushAndPrint(table, flattenedBalances);
}

export async function fetchAndPrintAllowancesAsync(
    accountDetails: {},
    contracts: any[],
    spender: string,
): Promise<void> {
    const flattenedAllowances = [];
    const flattenedAccounts = Object.keys(accountDetails).map(
        account => account.charAt(0).toUpperCase() + account.slice(1),
    );
    for (const token of contracts) {
        const tokenSymbol = await token.symbol.callAsync();
        const allowances = [tokenSymbol];
        for (const account in accountDetails) {
            const address = accountDetails[account];
            const balance = await token.allowance.callAsync(address, spender);
            allowances.push(balance.toString());
        }
        flattenedAllowances.push(allowances);
    }
    const table = new Table({
        ...dataSchema,
        head: ['Token', ...flattenedAccounts],
    });
    printHeader('Allowances');
    pushAndPrint(table, flattenedAllowances);
}

export async function awaitTransactionMinedSpinnerAsync(
    message: string,
    txHash: string,
    zeroEx: ZeroEx,
): Promise<TransactionReceiptWithDecodedLogs> {
    const spinner = ora(`${message}: ${txHash}`).start();
    if (!spinner['isSpinning']) {
        console.log(message, txHash);
    }
    try {
        const receipt = await zeroEx.awaitTransactionMinedAsync(txHash);
        receipt.status === 1 ? spinner.stop() : spinner.fail(message);
        return receipt;
    } catch (e) {
        spinner.fail(message);
        throw e;
    }
}

export function printTransaction(
    header: string,
    txReceipt: TransactionReceiptWithDecodedLogs,
    data: string[][] = [],
    events: string[] = ['Fill', 'Transfer', 'CancelUpTo', 'Cancel'],
): void {
    printHeader('Transaction');
    const status = txReceipt.status == 1 ? 'Success' : 'Failure';
    const headerColor = txReceipt.status == 1 ? 'green' : 'red';
    const table = new Table({
        ...defaultSchema,
        head: [header, txReceipt.transactionHash],
        style: { ...defaultSchema.style, head: [headerColor] },
    });

    const tableData = [...data, ['gasUsed', txReceipt.gasUsed.toString()], ['status', status]];
    pushAndPrint(table, tableData);

    if (txReceipt.logs.length > 0) {
        printHeader('Logs');
        for (const log of txReceipt.logs) {
            const event = (log as any).event;
            if (event && events.includes(event)) {
                const args = (log as any).args;
                const data = [['contract', log.address], ...Object.entries(args)];
                printData(`${event}`, data as any);
            }
        }
    }
}

enum OrderStatus {
    INVALID = 0, // Default value
    INVALID_MAKER_ASSET_AMOUNT = 1, // Order does not have a valid maker asset amount
    INVALID_TAKER_ASSET_AMOUNT = 2, // Order does not have a valid taker asset amount
    FILLABLE = 3, // Order is fillable
    EXPIRED = 4, // Order has already expired
    FULLY_FILLED = 5, // Order is fully filled
    CANCELLED = 6, // Order has been cancelled
}

export function printOrderInfos(orderInfos: {
    [key: string]: { orderStatus: number; orderHash: string; orderTakerAssetFilledAmount: BigNumber };
}) {
    const data = [];
    for (const order in orderInfos) {
        const orderInfo = orderInfos[order];
        const orderStatus = OrderStatus[orderInfo.orderStatus];
        data.push([order, orderStatus]);
    }
    printData('Order Info', data);
}
