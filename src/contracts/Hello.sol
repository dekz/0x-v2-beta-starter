pragma solidity ^0.4.23;
pragma experimental ABIEncoderV2;

contract IERC20Token {

    function transfer(address _to, uint256 _value)
        public
        returns (bool);

    function transferFrom(address _from, address _to, uint256 _value)
        public
        returns (bool);

    function approve(address _spender, uint256 _value)
        public
        returns (bool);

    function balanceOf(address _owner)
        public view
        returns (uint256);

    function allowance(address _owner, address _spender)
        public view
        returns (uint256);

    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 _value
    );

    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _value
    );
}

contract Hello {

    struct AddressBalanceQuery {
        address[] userAddresses;
        address contractAddress;
    }

    function batchQueryBalances(
        AddressBalanceQuery[] memory addressBalanceQueries
    )
        public
        returns (uint256[][] memory)
    {
        uint256 length = addressBalanceQueries.length;
        uint256[][] memory addressBalances = new uint256[][](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 userAddressLength = addressBalanceQueries[i].userAddresses.length;
            uint256[] memory balances = new uint256[](userAddressLength);
            for (uint256 n = 0; n < userAddressLength; n++) {
                uint256 balance = IERC20Token(addressBalanceQueries[i].contractAddress).balanceOf(addressBalanceQueries[i].userAddresses[n]);
                balances[n] = balance;
            }
            addressBalances[i] = balances;
        }
        return addressBalances;
    }
}
