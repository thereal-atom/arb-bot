import { PublicKey } from "@solana/web3.js";
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

const { connection, jupiter, wallet, config } = setup();

const mints = [
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
	"2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
	"J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
	"27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
	"12ifMz54Sq4Ab4RiPezsbDYkY2fo5L3VTabfJJ2ppump",
	"CVRR1ZcB6LRkybpUJRRcwc3LZDuc6hH7g8Uxihegpump",
	"2Kk16bkuFH8dsd117feYaqPjBYrF8NC5GCM2VMyKpump",
	"5ukFUcSw5NuiBMQEPucSfwBf1jKruoQvwxuuuicbpump",
	"2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump",
];

const runArb = async () => {
	// const log = createLog();

	try {
		const performance = trackPerformance("checking-for-profit");

		// const inAmountLamports = config.arbConfig.lamportAmountSol;
		const inAmountLamports = getRandomNumber(100_000_000, 1_000_000_000);
		// const inAmountLamports = 5_000_000_000;

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

		const jitoTip = Math.min(Math.floor(profitLamports / 2), 3_000_000);

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

		// const simulateResponse = await connection.simulateTransaction(transaction);
		// console.log(simulateResponse.value.logs);
		// console.log(`consumed ${simulateResponse.value.unitsConsumed} CUs`);

		// log.transaction = {
		// 	fetchedAt: Date.now(),
		// 	transaction: transaction,
		// };

		const bundleData = await sendJitoBundle([transaction]);

		// log.jtioBundle = {
		// 	fetchedAt: Date.now(),
		// 	bundle: bundleData.result,
		// };

		performance.event("sent-bundle");

		console.log("\x1b[33m%s\x1b[0m", bundleData.result);

		// saveLog(log);
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
