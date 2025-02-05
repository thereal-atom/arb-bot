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
// import { type Log, saveLog, createLog } from "./utils/logs";

const { connection, jupiter, wallet, config } = setup();

const mints = [
	// "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	// "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
	// "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
	// "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", // USDS
	// "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
	// "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
	// "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
	// "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb", // botify
	// "BrZmDQwbdLXme3uaea8znLhy9Bb3fucMJmcFBuRPpump", // cloudy
	// "2z1p8xCEjRzpBHjXWrx4tJnz7BFL6z7NnvbCxH7bpump", // san
	// "CBdCxKo9QavR9hfShgpEBG3zekorAeD7W1jfq2o3pump", // luce
	// "FLJYGHpCCcfYUdzhcfHSeSd2peb5SMajNWaCsRnhpump", // STORE
	// "DBpVGmVbMrw2vEbkhBu2cC3MvEg63opeRHdakVMEpump", // CHARM
	// "Hjw6bEcHtbHGpQr8onG3izfJY5DJiWdt7uk2BfdSpump", // SNAI
	// "6sSKobm4TSRqJuXMuczGdV2BZityP76PGBJJ2ALHpump", // Calicoin
	// "HWeZgfKdPWRkLBGnmze5YokeZg9tQ2MYceYUChDNpump", // BFC
	"399DmbmPgM8wPLQGDWs47W525RJRPn5K714nU6N5pump", // WIFOUT
	"H4phNbsqjV5rqk8u6FUACTLB6rNZRTAPGnBb8KXJpump", // SSE
	"FFs1bhpJHj4ANFdSUqhsMXgfjRNw8ZiwdxEALGFvF7r8", // APE
	// "8Q1X41xnj98LYNqwE1CSbC3NUcdhn4wRopH2WtKXSbyN", // STRAYAI
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
		const jitoTip = Math.floor(profitLamports * 0.9);
		// const jitoTip = 20_000;
		console.log(`jito tip is ${jitoTip.toLocaleString()} lamports`);

		// log.calculatedJitoTip = jitoTip;

		const threshold = 0.0001 * inAmountLamports;
		// const threshold = 30_000;
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

		const { arbTransaction, blockhash, tipWallet, minimumAmount } =
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
				minimumAmount,
			},
			blockhash,
			wallet,
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

// await runArb();

setInterval(runArb, config.arbConfig.attemptInterval);
