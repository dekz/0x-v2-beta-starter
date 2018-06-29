import { UNLIMITED_ALLOWANCE_IN_BASE_UNITS } from './constants';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';

const Table = require('cli-table');
const EMPTY_DATA = [];

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

export function printTransaction(
    header: string,
    txReceipt: TransactionReceiptWithDecodedLogs,
    data: string[][] = [],
    events: string[] = ['Fill', 'Transfer'],
): void {
    printHeader('Transaction');
    const table = new Table({
        ...defaultSchema,
        head: [header, ''],
    });

    const status = txReceipt.status == 1 ? 'Success' : 'Failure';
    const tableData = [
        ...data,
        ['txHash', txReceipt.transactionHash],
        ['gasUsed', txReceipt.gasUsed.toString()],
        ['status', status],
    ];
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
