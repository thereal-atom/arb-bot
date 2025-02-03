// import {
// 	Account,
// 	address,
// 	assertAccountExists,
// 	createSolanaRpc,
// 	decodeAccount,
// 	Decoder,
// 	EncodedAccount,
// 	fetchEncodedAccount,
// 	MaybeEncodedAccount,
// 	type Rpc,
// 	type SolanaRpcApiMainnet,
// } from "@solana/web3.js";

import { Connection } from "@solana/web3.js";

// export const initRpc = (rpcUrl: string) => {
// 	const rpc = createSolanaRpc(rpcUrl);

// 	return rpc;
// };

// export const getAccountBalance = async (
// 	rpc: Rpc<SolanaRpcApiMainnet>,
// 	pubKeyString: string,
// ) => {
// 	const balanceData = await rpc.getBalance(address(pubKeyString)).send();

// 	const balance = balanceData.value;

// 	return balance;
// };

// export const _decodeAccount = async <AccountData extends object>(
// 	rpc: Rpc<SolanaRpcApiMainnet>,
// 	decoder: Decoder<AccountData>,
// 	addressString: string,
// ): Promise<Account<AccountData, string>> => {
// 	const myAddress = address(typeof addressString);
// 	const myAccount = await fetchEncodedAccount(rpc, myAddress);
// 	myAccount satisfies MaybeEncodedAccount<typeof addressString>;

// 	assertAccountExists(myAccount);
// 	if (!myAccount satisfies EncodedAccount<typeof addressString>) {
// 		throw new Error("Account does not exist");
// 	}

// 	const myDecodedAccount = decodeAccount(myAccount, decoder);
// 	if (!myDecodedAccount satisfies Account<AccountData, typeof addressString>) {
// 		throw new Error("Account does not exist");
// 	}

// 	return myDecodedAccount;
// };

// export const getTokenAccountAmountByOwner = async (
// 	connection: Rpc<SolanaRpcApiMainnet>,
// 	ownerPubKeyString: string,
// 	mintAddress: string,
// ) => {
// 	const tokenAccountsData = await connection.getParsedTokenAccountsByOwner(
// 		address(ownerPubKeyString),
// 		{
// 			mint: address(mintAddress),
// 			programId: TOKEN_PROGRAM_ID,
// 		},
// 	);

// 	const tokenAccount = tokenAccountsData.value[0];
// 	if (!tokenAccount) return;

// 	return tokenAccount.account.data.parsed.info.tokenAmount as TokenAmount;
// };

// export const getTokenSupply = async (
// 	connection: Rpc<SolanaRpcApiMainnet>,
// 	mintAddress: string,
// ) => {
// 	const tokenSupplyData = await connection.getTokenSupply(
// 		address(mintAddress),
// 	);

// 	return tokenSupplyData.value;
// };

export const initRpcConnection = (rpcUrl: string) => {
	const connection = new Connection(rpcUrl, {
		commitment: "confirmed",
	});

	return connection;
};

export const confirmTransaction = async (
	connection: Connection,
	signature: string,
	timeoutMs = 60000,
) => {
	const start = Date.now();
	let status = await connection.getSignatureStatus(signature);

	while (Date.now() - start < timeoutMs) {
		status = await connection.getSignatureStatus(signature);
		if (status.value && status.value.confirmationStatus === "finalized") {
			return status;
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	throw new Error(
		`Transaction ${signature} failed to confirm within ${timeoutMs}ms`,
	);
};
