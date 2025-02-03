import { createJupiterApiClient } from "@jup-ag/api";
import { initRpcConnection } from "./solana";
import { config } from "../config";
import { Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

export const setup = () => {
	console.log("setting up arb bot...");

	const connection = initRpcConnection(config.rpc.url);
	const stakedConnection = initRpcConnection("http://173.231.43.226:4040");

	const jupiter = createJupiterApiClient({
		basePath: config.jupiter.swapApiUrl,
	});

	const wallet = new Wallet(
		Keypair.fromSecretKey(bs58.decode(config.wallet.privateKey)),
	);

	return {
		connection,
		jupiter,
		wallet,
		config,
	};
};
