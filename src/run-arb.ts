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

const { connection, jupiter, wallet, config, logtail } = setup();

const mints = [
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
	// "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
	// "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", // USDS
	"J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
	"27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
	// "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
	"AxriehR6Xw3adzHopnvMn7GcpRFcD41ddpiTWMg6pump", // jailstool
	"8KMfU13W1ayhBEyWrZTe8hPTNbZo2cLJrH3pTqNqpump", // Montoya
	"644MryX1MXBNjA8QEUNeQ5HSEVZZqGRzPdiLz4EBpump", // JAILMURAD
];

const runArb = async () => {
	// const log = createLog();

	const ctx: Record<string, any> = { errorLogs: [] };

	try {
		const performance = trackPerformance("checking-for-profit");

		ctx.startTimestamp = performance.startTimestamp;

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

		const mint = mints[Math.floor(Math.random() * mints.length)];

		const { quote, reverseQuote } = await getArbitrageQuotes(jupiter, {
			mintB: mint,
			uiAmountSol,
		});

		const gotQuoteTimestamp = performance.event("got-quote");

		const { profitLamports, profitPercent } = getQuoteProfit(
			quote,
			reverseQuote,
		);

		ctx.quoteData = {
			gotQuoteTimestamp,
			quote: quote.rawQuote,
			reverseQuote: reverseQuote.rawQuote,
		};

		const jitoTip = Math.floor(profitLamports * 0.5);

		const threshold = 100_000;

		ctx.main = {
			arbConfig: config.arbConfig,
			inAmountLamports,
			mint,
			mintList: mints,
			calculatedProfit: profitLamports,
			calculatedProfitPercent: profitPercent,
			threshold,
			jitoTip,
		};

		if (profitLamports < threshold) {
			// logtail.warn("unprofitable tx. not continuing", ctx);

			return;
		}

		const combinedQuote = combineQuotes(quote.rawQuote, reverseQuote.rawQuote);

		const instructions = await getJupiterSwapTransactionInstructions(
			jupiter,
			wallet,
			combinedQuote,
		);

		const gotIxsTimestamp = performance.event("got-instructions");

		ctx.gotIxsTimestamp = gotIxsTimestamp;

		const wsolTokenAccountAddress = config.wallet.wsolTokenAccountAddress;

		ctx.main.wsolTokenAccountAddress = wsolTokenAccountAddress;

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
				config.arbConfig.sendMode,
			);

		// const simRes = await connection.simulateTransaction(arbTransaction);
		// console.log(simRes.value);

		const constructedTxTimestamp = performance.event("constructed-transaction");

		ctx.constructedTxTimestamp = constructedTxTimestamp;

		if (config.arbConfig.sendMode === "jito") {
			if (!tipWallet || !minimumAmount) {
				throw new Error(
					"send mode was jito, but tip wallet or minimum amount was not returned.",
				);
			}

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

			ctx.constructedTipTxTimestamp = performance.event(
				"constructed-tip-transaction",
			);
			ctx.tipWalletPublicKey = tipWallet.publicKey.toBase58();
			ctx.minimumAmount = minimumAmount;

			const { data: bundleData, proxyUrl: jitoProxyUrl } = await sendJitoBundle(
				[arbTransaction, tipTransaction],
			);

			ctx.sentBundleTimestamp = performance.event("sent-bundle");
			ctx.bundleData = bundleData;
			ctx.jitoProxyUrl = jitoProxyUrl;

			console.log("\x1b[33m%s\x1b[0m", bundleData.result);

			ctx.sendTransactionTimestamp = performance.event("sent-transaction");
		} else {
			const signature = await connection.sendRawTransaction(
				arbTransaction.serialize(),
			);

			performance.event("sent tx");
			console.log(
				"\x1b[33m%s\x1b[0m",
				`sent transaction with signature ${signature}`,
			);

			ctx.arbTxSignature = signature;
			ctx.sendTransactionTimestamp = performance.event("sent-transaction");

			const blockhash = await connection.getLatestBlockhash();

			const confirmation = await connection.confirmTransaction(
				{
					signature,
					...blockhash,
				},
				"confirmed",
			);

			ctx.arbTxConfirmation = confirmation;

			console.log(
				"\x1b[33m%s\x1b[0m",
				`transaction confirmed with status ${JSON.stringify(confirmation)}`,
			);
		}

		// await logtail.success("sent transaction", ctx);

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	} catch (error: any) {
		console.log(error);
		console.log("\x1b[31m%s\x1b[0m", "failed.");

		ctx.errorLogs = [...ctx.errorLogs, error.message];

		// await logtail.error("error sending transaction", ctx);

		// log.errorLogs = [...log.errorLogs, error.message];
		// saveLog(log);
	}
};

// await runArb();

setInterval(runArb, config.arbConfig.attemptInterval);
