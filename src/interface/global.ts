export enum Type {
	ERC20 = "ERC20",
	ERC721 = "ERC721",
	ERC1155 = "ERC1155",
}

export enum Network {
	ETHEREUM_MAINNET = "ethereum-mainnet",
	ETHEREUM_ROPSTEN = "ethereum-ropsten",
	ETHEREUM_GOERLI = "ethereum-goerli",

	BINANCE_MAINNET = "binance-mainnet",
	BINANCE_TESTNET = "binance-testnet",

	POLYGON_MAINNET = "polygon-mainnet",
	POLYGON_MUMBAI = "polygon-mumbai",

	AVALANCHE_FUJI = "avalanche-fuji",
	AVALANCHE_MAINNET = "avalanche-mainnet",
}

export const watcherTypes = {
	ERC20: ["EVENT_TRANSFER"],
	ERC721: ["ERC721_EVENT_TRANSFER"],
	ERC1155: ["ERC1155_EVENT_TRANSFER_SINGLE", "ERC1155_EVENT_TRANSFER_BATCH"],
}
