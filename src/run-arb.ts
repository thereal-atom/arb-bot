import { createJupiterApiClient } from "@jup-ag/api";
import { Wallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { config } from "./config";
import {
	combineQuotes,
	constructArbitrageTransaction,
	getArbitrageQuotes,
	getQuoteProfit,
} from "./utils/arb";
import { initRpcConnection } from "./utils/solana";
import { getJupiterSwapTransactionInstructions } from "./utils/jupiter";
import { sendJitoBundle } from "./utils/jito";
import { trackPerformance } from "./utils/common";
import { randomUUIDv7 } from "bun";
import { type Log, saveLog } from "./utils/logs";

console.log("starting arb bot...");

const connection = initRpcConnection(config.rpc.url);

const jupiter = createJupiterApiClient({
	basePath: config.jupiter.swapApiUrl,
});
const wallet = new Wallet(
	Keypair.fromSecretKey(bs58.decode(config.wallet.privateKey)),
);

setInterval(async () => {
	// const log: Log = {
	// 	id: randomUUIDv7(),
	// 	timestamp: Date.now(),
	// 	errorLogs: [],
	// };

	try {
		const performance = trackPerformance("checking-for-profit");

		const uiAmountSol = 0.4;

		// log.inAmountLamports = uiAmountSol * 10 ** 9;

		const { quote, reverseQuote } = await getArbitrageQuotes(jupiter, {
			mintB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			uiAmountSol,
		});

		// console.log(quote);
		// console.log(reverseQuote);

		// log.quotes = {
		// 	quote: {
		// 		fetchedAt: Date.now(),
		// 		quote: quote,
		// 	},
		// 	reverseQuote: {
		// 		fetchedAt: Date.now(),
		// 		quote: reverseQuote,
		// 	},
		// };

		performance.event("got-quote");

		const { profitLamports, profitPercent } = getQuoteProfit(
			quote,
			reverseQuote,
		);

		// log.calculatedProfitLamports = profitLamports;

		console.log(
			`${quote.inAmount} → ${reverseQuote.outAmount} SOL (${profitLamports.toFixed(5)} lamports, ${profitPercent}%)`,
		);

		const jitoTip = Math.min(Math.floor(profitLamports / 2), 1_000_000);

		// log.calculatedJitoTip = jitoTip;

		const threshold = 100_000;
		if (profitLamports < threshold) {
			// saveLog(log);

			return;
		}

		console.log(
			"\x1b[35m%s\x1b[0m",
			`profitable opportunity found: ${profitLamports.toFixed(5)} SOL (${profitPercent}%)`,
		);

		const combinedQuote = combineQuotes(quote.rawQuote, reverseQuote.rawQuote);

		const instructions = await getJupiterSwapTransactionInstructions(
			jupiter,
			wallet,
			combinedQuote,
		);

		// log.jupiterSwapTransactionInstructions = {
		// 	fetchedAt: Date.now(),
		// 	instructions: instructions,
		// };

		performance.event("got-instructions");

		const transaction = await constructArbitrageTransaction(
			connection,
			wallet,
			instructions,
			jitoTip,
		);

		// const simulateResponse = await connection.simulateTransaction(transaction);
		// console.log(simulateResponse);

		// log.transaction = {
		// 	fetchedAt: Date.now(),
		// 	transaction: transaction,
		// };

		performance.event("constructed-transaction");

		const bundleData = await sendJitoBundle([transaction]);

		// log.jtioBundle = {
		// 	fetchedAt: Date.now(),
		// 	bundle: bundleData.result,
		// };

		performance.event("sent-bundle");

		console.log(bundleData.result);

		// saveLog(log);
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	} catch (error: any) {
		console.log("\x1b[31m%s\x1b[0m", "failed.");

		// log.errorLogs = [...log.errorLogs, error.message];
		// saveLog(log);
	}
}, 200);
