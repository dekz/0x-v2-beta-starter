import { Card, CardImage, CardContent, Media, Image, MediaContent, Title, Subtitle, Button, TextArea } from 'bloomer';
import * as React from 'react';
import { KittyData } from './kittyHelper';
import { CardFooter, CardFooterItem } from 'bloomer';
import { CardHeader } from '../../../node_modules/bloomer/lib/components/Card/Header/CardHeader';
import { CardHeaderTitle } from '../../../node_modules/bloomer/lib/components/Card/Header/CardHeaderTitle';

interface ItemProps extends KittyData {
    onBuyKitty: () => void;
}
export class Item extends React.Component<ItemProps, { showDetails: boolean }> {
    constructor(props: ItemProps) {
        super(props);
        this.state = { showDetails: false };
    }
    toggleDetails = () => {
        this.setState(prevState => {
            return {
                ...prevState,
                showDetails: !prevState.showDetails,
            };
        });
    }
    renderItemContent() {
        return (
            <Card>
                <CardImage style={{ backgroundColor: this.props.background }}>
                    <Image src={this.props.image} />
                </CardImage>
                <CardContent>
                    <Media>
                        <MediaContent>
                            <Title isSize={6}>Kitty {this.props.id}</Title>
                            <Subtitle isSize={6}>
                                Gen {this.props.gen} - Plodding -{' '}
                                <a href="#" onClick={this.toggleDetails}>
                                    {' '}
                                    Details{' '}
                                </a>
                            </Subtitle>
                        </MediaContent>
                    </Media>
                </CardContent>
                <CardFooter>
                    <CardFooterItem>
                        <Button isFullWidth={true} isOutlined={false} isColor="white" onClick={this.props.onBuyKitty}>
                            Buy for Ξ {this.props.price}
                        </Button>
                    </CardFooterItem>
                </CardFooter>
            </Card>
        );
    }
    renderDetailsContent() {
        return (
            <Card>
                <CardHeader>
                    <CardHeaderTitle> Details </CardHeaderTitle>
                </CardHeader>
                <CardContent>
                    <TextArea readOnly={true} isSize="small">
                        {JSON.stringify(this.props.order, null, 2)}
                    </TextArea>
                </CardContent>
                <CardFooter>
                    <CardFooterItem>
                        <a href="#" onClick={this.toggleDetails}>
                            Hide Details
                        </a>
                    </CardFooterItem>
                </CardFooter>
            </Card>
        );
    }
    render() {
        return this.state.showDetails ? this.renderDetailsContent() : this.renderItemContent();
    }
}
