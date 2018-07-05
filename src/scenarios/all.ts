import { providerEngine } from '../contracts';
import { scenario as fillOrder } from './fill_order';
import { scenario as fillOrderFees } from './fill_order_fees';
import { scenario as fillOrderERC721 } from './fill_order_erc721';
import { scenario as matchOrders } from './match_orders';
import { scenario as executeTransaction } from './execute_transaction';
import { scenario as cancelOrdersUpTo } from './cancel_orders_up_to';

(async () => {
    try {
        await fillOrder();
        await fillOrderFees();
        await fillOrderERC721();
        await matchOrders();
        await executeTransaction();
        await cancelOrdersUpTo();
    } catch (e) {
        console.log(e);
        providerEngine.stop();
    }
})();
