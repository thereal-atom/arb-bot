import { PublicKey, sendAndConfirmRawTransaction } from "@solana/web3.js";
import {
	combineQuotes,
	constructArbitrageTransaction,
	getArbitrageQuotes,
	getQuoteProfit,
} from "./utils/arb";
import { getJupiterSwapTransactionInstructions } from "./utils/jupiter";
import { sendJitoBundle } from "./utils/jito";
import { getRandomNumber, trackPerformance, WSOL_MINT } from "./utils/common";
import { setup } from "./utils/setup";
// import { type Log, saveLog, createLog } from "./utils/logs";

const { connection, stakedConnection, jupiter, wallet, config } = setup();

const mints = [
	// "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	// "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
	// "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
	// "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", // USDS
	// "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
	// "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
	"B29VFNAL4vh7rNcZMCmsHkZaYzUaVj3UinU3dFh6pump", // Friday AI
	"61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump", // Arc
	"HWeZgfKdPWRkLBGnmze5YokeZg9tQ2MYceYUChDNpump", // BFC
	"5csfa95Xf8ebiCwP9joQ7mtC8KwFvnnejnYx5FbYpump", // XMONEY
	"7XJiwLDrjzxDYdZipnJXzpr1iDTmK55XixSFAa7JgNEL", // MLG
];

const runArb = async () => {
	// const log = createLog();

	try {
		const performance = trackPerformance("checking-for-profit");

		const inAmountLamports =
			config.arbConfig.amount.mode === "fixed"
				? config.arbConfig.amount.fixed
				: config.arbConfig.amount.mode === "random"
					? getRandomNumber(
							config.arbConfig.amount.minimum,
							config.arbConfig.amount.maximum,
						)
					: 10_000_000;

		const uiAmountSol = inAmountLamports / 10 ** 9;

		// log.inAmountLamports = inAmount;

		const { quote, reverseQuote } = await getArbitrageQuotes(jupiter, {
			mintB: mints[Math.floor(Math.random() * mints.length)],
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

		// const jitoTip = Math.min(Math.floor(profitLamports / 2), 3_000_000);
		const jitoTip = Math.floor(profitLamports * 0.75);
		console.log(`jito tip is ${jitoTip.toLocaleString()} lamports`);

		// log.calculatedJitoTip = jitoTip;

		// const threshold = config.arbConfig.thresholdLamports;
		const threshold = 0.0001 * inAmountLamports;
		console.log(`threshold is ${threshold.toLocaleString()} lamports`);
		if (profitLamports < threshold) {
			// saveLog(log);

			return;
		}

		console.log(
			"\x1b[35m%s\x1b[0m",
			`profitable opportunity found: ${profitLamports.toFixed(5)} SOL (${profitPercent}%)`,
		);

		const combinedQuote = combineQuotes(quote.rawQuote, reverseQuote.rawQuote);

		// console.log(combinedQuote);

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

		const wsolTokenAccountAddress = config.wallet.wsolTokenAccountAddress;

		// console.log(`jupiter requested ${instructions.computeUnitLimit} CUs`);

		const transaction = await constructArbitrageTransaction(
			connection,
			wallet,
			instructions,
			{
				borrowInstructionData: {
					walletData: {
						mintTokenAccount: new PublicKey(wsolTokenAccountAddress),
					},
					options: {
						amount: inAmountLamports,
						mint: WSOL_MINT,
					},
				},
				repayInstructionData: {
					walletData: {
						mintTokenAccount: new PublicKey(wsolTokenAccountAddress),
					},
					options: {
						amount: inAmountLamports,
						mint: WSOL_MINT,
					},
				},
			},
			jitoTip,
			"kamino",
		);

		performance.event("constructed-transaction");

		// if (config.arbConfig.shouldSimulate) {
		const simulateResponse = await connection.simulateTransaction(transaction, {
			commitment: "confirmed",
		});
		// // console.log(simulateResponse.value.logs);
		// console.log(`consumed ${simulateResponse.value.unitsConsumed} CUs`);
		// // }

		const errorLogs = simulateResponse.value.logs?.find((log) =>
			log.includes("error"),
		);
		if (errorLogs) {
			console.log(errorLogs);

			return;
		}

		// const sendType: "bundle" | "transaction" = "transaction";

		// if (sendType === "bundle") {
		// const bundleData = await sendJitoBundle([transaction]);

		// performance.event("sent-bundle");

		// console.log("\x1b[33m%s\x1b[0m", bundleData.result);
		// } else {
		console.log("sending tx");
		const signature = await connection.sendRawTransaction(
			transaction.serialize(),
		);

		// console.log(
		// 	"\x1b[33m%s\x1b[0m",
		// 	`sent transaction with signature ${signature}`,
		// );

		// const signature = await sendAndConfirmRawTransaction(
		// 	stakedConnection,
		// 	Buffer.from(transaction.serialize()),
		// 	{
		// 		commitment: "confirmed",
		// 		skipPreflight: true,
		// 		preflightCommitment: "confirmed",
		// 		maxRetries: 0,
		// 	},
		// );

		console.log(`sent transaction with signature ${signature}`);

		// const blockhash = await connection.getLatestBlockhash();

		// const confirmation = await connection.confirmTransaction(
		// 	{
		// 		signature,
		// 		...blockhash,
		// 	},
		// 	"confirmed",
		// );

		// console.log(
		// 	`transaction confirmed with status ${JSON.stringify(confirmation)}`,
		// );

		performance.event("sent-transaction");
		// }

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	} catch (error: any) {
		console.log(error);
		console.log("\x1b[31m%s\x1b[0m", "failed.");

		// log.errorLogs = [...log.errorLogs, error.message];
		// saveLog(log);
	}
};

// await runArb();

setInterval(runArb, config.arbConfig.attemptInterval);
