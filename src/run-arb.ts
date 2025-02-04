import { PublicKey, sendAndConfirmRawTransaction } from "@solana/web3.js";
import {
	combineQuotes,
	constructArbitrageTransaction,
	constructTipTransaction,
	getArbitrageQuotes,
	getQuoteProfit,
} from "./utils/arb";
import { getJupiterSwapTransactionInstructions } from "./utils/jupiter";
import { sendJitoBundle } from "./utils/jito";
import { getRandomNumber, trackPerformance, WSOL_MINT } from "./utils/common";
import { setup } from "./utils/setup";
import { Keypair } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import { type Log, saveLog, createLog } from "./utils/logs";

const { connection, stakedConnection, jupiter, wallet, config } = setup();

const mints = [
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
	"2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
	"USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", // USDS
	"J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
	"27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
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
		const jitoTip = Math.floor(profitLamports * 0.4);
		console.log(`jito tip is ${jitoTip.toLocaleString()} lamports`);

		// log.calculatedJitoTip = jitoTip;

		// const threshold = config.arbConfig.thresholdLamports;
		const threshold = 0.0001 * inAmountLamports;
		console.log(`threshold is ${threshold.toLocaleString()} lamports`);
		if (profitLamports < threshold) {
			// saveLog(log);

			return;
		}

		// console.log(
		// 	"\x1b[35m%s\x1b[0m",
		// 	`profitable opportunity found: ${profitLamports.toFixed(5)} SOL (${profitPercent}%)`,
		// );

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

		const { arbTransaction, blockhash, tipWallet } =
			await constructArbitrageTransaction(
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
				{
					jitoTip: Math.abs(jitoTip),
				},
			);

		// const simRes = await connection.simulateTransaction(arbTransaction);
		// console.log(simRes.value);

		performance.event("constructed-transaction");

		const tipTransaction = constructTipTransaction(
			{
				amount: Math.abs(jitoTip),
				wallet: tipWallet,
			},
			blockhash,
		);

		// const simulateRes = await connection.simulateTransaction(tipTransaction);
		// console.log(simulateRes);

		performance.event("constructed-tip-transaction");

		const bundleData = await sendJitoBundle([arbTransaction, tipTransaction]);

		performance.event("sent-bundle");

		console.log("\x1b[33m%s\x1b[0m", bundleData.result);

		performance.event("sent-transaction");
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	} catch (error: any) {
		console.log(error);
		console.log("\x1b[31m%s\x1b[0m", "failed.");

		// log.errorLogs = [...log.errorLogs, error.message];
		// saveLog(log);
	}
};

await runArb();

// setInterval(runArb, config.arbConfig.attemptInterval);
