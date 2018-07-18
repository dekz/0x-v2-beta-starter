import { Container, Columns, Column } from 'bloomer';
import * as React from 'react';
import { KittyData } from './kittyHelper';
import { Item } from './Item';

function listToMatrix(list: KittyData[], elementsPerSubArray: number): KittyData[][] {
    var matrix = [],
        i,
        k;
    for (i = 0, k = -1; i < list.length; i++) {
        if (i % elementsPerSubArray === 0) {
            k++;
            matrix[k] = [];
        }
        matrix[k].push(list[i]);
    }
    return matrix;
}
interface MarketplaceProps {
    kittyData: KittyData[];
    onBuyKitty: (kitty: KittyData) => void;
}
export class Marketplace extends React.Component<MarketplaceProps, {}> {
    constructor(props: MarketplaceProps) {
        super(props);
    }
    render() {
        const matrix = listToMatrix(this.props.kittyData, 4);
        return (
            <Container>
                {matrix.map(kitties => {
                    const kittiesRender = kitties.map(kitty => {
                        return (
                            <Column key={kitty.id} isSize="1/4">
                                <Item {...kitty} onBuyKitty={() => this.props.onBuyKitty(kitty)} />
                            </Column>
                        );
                    });
                    return <Columns key={kitties.map(kitty => kitty.id).toString()}>{kittiesRender}</Columns>;
                })}
            </Container>
        );
    }
}
