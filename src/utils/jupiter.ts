import type { DefaultApi, QuoteResponse } from "@jup-ag/api";
import type { Wallet } from "@coral-xyz/anchor";
import { WSOL_MINT } from "./common";
import { config } from "../config";

export type JupiterApiClient = DefaultApi;

export const createJupiterSwapFetch = (options: {
	inputMint: string;
	outputMint: string;
	amount: number;
}) => {
	return fetch(
		`https://api.jup.ag/swap/v1/quote?inputMint=${options.inputMint}&outputMint=${options.outputMint}&amount=${options.amount}&slippageBps=100`,
	);
};

export const getJupiterSwapQuote = async (
	jupiter: JupiterApiClient,
	options: {
		inputMint: string;
		outputMint: string;
		amount: number;
		slippageBps?: number;
	},
) => {
	const searchParams = new URLSearchParams({
		inputMint: options.inputMint,
		outputMint: options.outputMint,
		amount: Math.floor(options.amount).toString(),
		slippageBps: "0",
		excludeDexes: ["Obric V2"].join(","),
		maxAccounts: "20",
	});

	console.log(options);
	console.log(Math.floor(options.amount).toString());

	const res = await fetch(
		`${config.jupiter.swapApiUrl}/quote-and-simulate?${searchParams}`,
	);

	if (!res.ok) {
		console.log(res);

		throw new Error("failed to fetch quote");
	}

	const rawQuote = await res.json();

	return {
		...rawQuote,
		inAmount: Number.parseFloat(rawQuote.inAmount),
		// sol/wsol decimals are 9 while meme token decimals are 6 (which is what the other inputMint options is)
		inUiAmount:
			Number.parseFloat(rawQuote.inAmount) /
			10 ** (options.inputMint === WSOL_MINT ? 9 : 6),
		outAmount: Number.parseFloat(rawQuote.outAmount),
		outUiAmount:
			Number.parseFloat(rawQuote.outAmount) /
			10 ** (options.outputMint === WSOL_MINT ? 9 : 6),
		rawQuote: rawQuote,
	};
};

export type CustomJupiterQuote = Awaited<
	ReturnType<typeof getJupiterSwapQuote>
>;

export const getSolPrice = async (jupiter: JupiterApiClient) => {
	const res = await fetch(`https://api.jup.ag/price/v2?ids=${WSOL_MINT}`);

	const data = await res.json();

	return Number.parseFloat(data.data[WSOL_MINT].price || "0");
};

export const getJupiterSwapTransactionInstructions = async (
	jupiter: JupiterApiClient,
	wallet: Wallet,
	quote: QuoteResponse,
) => {
	const jupiterSwapTransactionResponse = await fetch(
		`${config.jupiter.swapApiUrl}/swap-instructions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				userPublicKey: wallet.publicKey.toBase58(),
				useSharedAccounts: false,
				computeUnitPriceMicroLamports: 1,
				dynamicComputeUnitLimit: true,
				skipUserAccountsRpcCalls: true,
				quoteResponse: quote,
				wrapAndUnwrapSol: false,
			}),
		},
	);

	if (!jupiterSwapTransactionResponse.ok) {
		console.log(jupiterSwapTransactionResponse);

		throw new Error("failed to fetch swap transactions");
	}

	const instructions = await jupiterSwapTransactionResponse.json();

	return instructions;
};
