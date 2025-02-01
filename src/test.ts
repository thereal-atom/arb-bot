// import { simulateTransaction } from "@coral-xyz/anchor/dist/cjs/utils/rpc";
// import {
// 	createJupiterSwapFetch,
// 	getMultipleJupiterSwapTransactions,
// } from "./utils/jupiter";
// import { Keypair, VersionedTransaction } from "@solana/web3.js";
// import { confirmTransaction, initRpcConnection } from "./utils/solana";
// import { config } from "./config";
// import { Wallet } from "@coral-xyz/anchor";
// import bs58 from "bs58";

// const connection = initRpcConnection(config.rpc.url);

// const WSOL_MINT = "So11111111111111111111111111111111111111112";
// const memeTokenMint =
// 	process.argv[2] || "ALkQJUv8WLr5ret3meLHuDHhLxNHvYRzvgucn5jpump";

// const wallet = new Wallet(
// 	Keypair.fromSecretKey(bs58.decode(config.wallet.privateKey)),
// );

// const start = Date.now();

// const uiAmountSol = 0.0005;

// const solQuote = await createJupiterSwapFetch({
// 	inputMint: WSOL_MINT,
// 	outputMint: memeTokenMint,
// 	amount: uiAmountSol * 10 ** 9,
// });

// if (!solQuote.ok) {
// 	console.error(solQuote);

// 	throw new Error(`route not found for ${memeTokenMint}`);
// }

// const solQuoteData = await solQuote.json();

// if (!solQuoteData) {
// 	console.error(solQuoteData);

// 	throw new Error(`route not found for ${memeTokenMint}`);
// }

// const outputAmount = Number.parseFloat(solQuoteData.outAmount);

// const memeTokenQuote = await createJupiterSwapFetch({
// 	inputMint: memeTokenMint,
// 	outputMint: WSOL_MINT,
// 	amount: outputAmount,
// });

// const memeTokenQuoteData = await memeTokenQuote.json();

// const finalSolOutAmount =
// 	Number.parseFloat(memeTokenQuoteData.outAmount) / 10 ** 9;

// console.log(
// 	`${uiAmountSol} SOL → ${outputAmount / 10 ** 6} ${memeTokenMint.slice(0, 4)} → ${finalSolOutAmount} SOL`,
// );

// console.log(`took ${Date.now() - start}ms`);

// const profit = finalSolOutAmount - uiAmountSol;

// // const solPriceResponse = await fetch(
// // 	`https://api.jup.ag/price/v2?ids=${WSOL_MINT}`,
// // );
// // const solPriceData = await solPriceResponse.json();

// // console.log(solPriceData.data[WSOL_MINT].price || "0");

// // const solPrice = Number.parseFloat(solPriceData.data[WSOL_MINT] || "0");

// console.log(
// 	`Profit: ${profit.toFixed(3)} SOL (${((profit / uiAmountSol) * 100).toFixed(3)}%)`,
// );

// // throw new Error(
// // 	"next executing trades. testing to see if profitable opportunities happen often enough.",
// // );

// // if (profit > 0) {
// // 	throw new Error("not executing trades. profit too small.");
// // }

// // console.log(solQuoteData);

// const swapTransactionResponses = await Promise.all(
// 	[solQuoteData, memeTokenQuoteData].map((data) => {
// 		return fetch("https://api.jup.ag/swap/v1/swap", {
// 			method: "POST",
// 			headers: {
// 				"Content-Type": "application/json",
// 			},
// 			body: JSON.stringify({
// 				quoteResponse: data,
// 				userPublicKey: wallet.publicKey.toString(),
// 				dynamicSlippage: { minBps: 50, maxBps: 300 },
// 				dynamicComputeUnitLimit: true,
// 				prioritizationFeeLamports: {
// 					// priorityLevelWithMaxLamports: {
// 					// 	maxLamports: 4_000_000,
// 					// 	global: false,
// 					// 	priorityLevel: "veryHigh",
// 					// },
// 					jitoTipLamports: 35_000_000,
// 				},
// 			}),
// 		});
// 	}),
// );

// if (!swapTransactionResponses.every((response) => response.ok)) {
// 	console.log(swapTransactionResponses);

// 	throw new Error("failed to fetch swap transactions");
// }

// const swapTransactionData = await Promise.all(
// 	swapTransactionResponses.map((response) => response.json()),
// );

// const swapTransactionsBuffers = swapTransactionData.map((data) =>
// 	Buffer.from(data.swapTransaction, "base64"),
// );
// const swapTransactions = swapTransactionsBuffers.map((buffer) => {
// 	const tx = VersionedTransaction.deserialize(buffer);

// 	tx.sign([wallet.payer]);

// 	return tx;
// });

// // const swapTransactions = await getMultipleJupiterSwapTransactions(wallet, [
// // 	solQuoteData,
// // 	memeTokenQuoteData,
// // ]);

// // const simulatedTransactions = await Promise.all(
// // 	swapTransactions.map((tx) => connection.simulateTransaction(tx)),
// // );

// // console.log(simulatedTransactions[0].value.logs);
// // console.log(simulatedTransactions[1].value.logs);

// const jitoTxResponse = await fetch(
// 	"https://mainnet.block-engine.jito.wtf/api/v1/bundles",
// 	{
// 		method: "POST",
// 		headers: {
// 			"Content-Type": "application/json",
// 		},
// 		body: JSON.stringify({
// 			id: 1,
// 			jsonrpc: "2.0",
// 			method: "sendBundle",
// 			params: [swapTransactions.map((tx) => bs58.encode(tx.serialize()))],
// 		}),
// 	},
// );

// if (!jitoTxResponse.ok) {
// 	console.log(jitoTxResponse);

// 	throw new Error("failed to send transaction");
// }

// const jitoTxData = await jitoTxResponse.json();

// const txId = jitoTxData.result;

// console.log(jitoTxData);

// const jitoStatusResponse = await fetch(
// 	"https://mainnet.block-engine.jito.wtf/api/v1/getInflightBundleStatuses",
// 	{
// 		method: "POST",
// 		headers: {
// 			"Content-Type": "application/json",
// 		},
// 		body: JSON.stringify({
// 			id: 1,
// 			jsonrpc: "2.0",
// 			method: "getInflightBundleStatuses",
// 			params: [[txId]],
// 		}),
// 	},
// );

// if (!jitoStatusResponse.ok) {
// 	console.log(jitoStatusResponse);

// 	throw new Error("failed to get status of transaction");
// }

// const jitoStatusData = await jitoStatusResponse.json();

// console.log(jitoStatusData.result);

// // console.log(`https://solscan.io/tx/${txId}`);

// // https://github.com/jito-labs/jito-js-rpc/blob/master/examples/basic_txn.js#L100

// // await confirmTransaction(connection, txId);

// // const startedTx = Date.now();

// // const latestBlockHash = await connection.getLatestBlockhash();

// // const txid = await connection.sendRawTransaction(tx.serialize(), {
// // 	skipPreflight: true,
// // 	maxRetries: 2,
// // });

// // await connection.confirmTransaction({
// // 	blockhash: latestBlockHash.blockhash,
// // 	lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
// // 	signature: txid,
// // });

// // console.log(`https://solscan.io/tx/${txid}`);
// // console.log(`tx took ${Date.now() - startedTx}ms`);

// import { createJupiterApiClient } from "@jup-ag/api";
// import {
// 	getMultipleJupiterSwapTransactionInstructions,
// 	getMultipleJupiterSwapTransactions,
// 	getSolPrice,
// 	type CustomJupiterQuote,
// } from "./utils/jupiter";
// import { getArbitrageQuotes } from "./utils/arb";
// import { Wallet } from "@coral-xyz/anchor";
// import {
// 	Keypair,
// 	Transaction,
// 	TransactionMessage,
// 	VersionedTransaction,
// } from "@solana/web3.js";
// import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
// import { config } from "./config";
// import { checkJitoBundleStatus, sendJitoBundle } from "./utils/jito";
// import { initRpcConnection } from "./utils/solana";

// console.log("starting arb bot...");

// const jupiter = createJupiterApiClient();
// const wallet = new Wallet(
// 	Keypair.fromSecretKey(bs58.decode(config.wallet.privateKey)),
// );
// // const connection = initRpcConnection(config.rpc.url);

// // setInterval(async () => {
// console.log(`[${new Date().toLocaleTimeString()}] checking for profit...`);

// const solPrice = 239; // await getSolPrice(jupiter);

// try {
// 	const startGetQuote = Date.now();

// 	const { quote, reverseQuote } = await getArbitrageQuotes(jupiter, {
// 		memeTokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
// 		uiAmountSol: 0.5,
// 	});

// 	// console.log(`[get quote] took ${Date.now() - startGetQuote}ms`);

// 	// const calculateProfit = (
// 	// 	quote: CustomJupiterQuote,
// 	// 	reverseQuote: CustomJupiterQuote,
// 	// ) => {
// 	// 	const uiAmount = reverseQuote.outUiAmount - quote.inUiAmount;
// 	// 	const percent = (uiAmount / quote.inUiAmount) * 100;

// 	// 	return {
// 	// 		uiAmount,
// 	// 		percent,
// 	// 	};
// 	// };

// 	// const profit = calculateProfit(quote, reverseQuote);

// 	// console.log(
// 	// 	`${quote.inUiAmount} SOL → ${quote.outUiAmount} ${quote.outputMint.slice(0, 4)} → ${reverseQuote.outUiAmount} SOL`,
// 	// );

// 	// if (profit.percent < 0.1) {
// 	// 	// console.log(
// 	// 	// 	`not profitable. ${quote.inUiAmount} → ${reverseQuote.outUiAmount} SOL (${profit.percent.toFixed(5)}%)`,
// 	// 	// );
// 	// 	// return;
// 	// }

// 	// console.log(
// 	// 	"\x1b[35m%s\x1b[0m",
// 	// 	`profitable opportunity found: ${profit.uiAmount.toFixed(5)} SOL ($${profit.uiAmount * solPrice}) (${profit.percent.toFixed(5)}%)`,
// 	// );

// 	// // todo: on profitable opportunity found, if error when fetching tx then retry fetching tx (not many times as will exceed slippage quickly)

// 	// const startGetTx = Date.now();

// 	// const swapTransactions = await getMultipleJupiterSwapTransactions(wallet, [
// 	// 	quote.rawQuote,
// 	// 	reverseQuote.rawQuote,
// 	// ]);

// 	// console.log(`[get tx] took ${Date.now() - startGetTx}ms`);

// 	// const ixs = await getMultipleJupiterSwapTransactionInstructions(wallet, [
// 	// 	quote.rawQuote,
// 	// 	reverseQuote.rawQuote,
// 	// ]);

// 	// console.log(ixs);

// 	// const startSimulateTx = Date.now();

// 	// const simulatedTransactions = await Promise.all(
// 	// 	swapTransactions.map((tx) => connection.simulateTransaction(tx)),
// 	// );

// 	// console.log(`[simulate tx] took ${Date.now() - startSimulateTx}ms`);

// 	// const slippageLimitExceededLog = simulatedTransactions[0].value.logs?.find(
// 	// 	(log) => log.includes("0x1771"),
// 	// );

// 	// if (slippageLimitExceededLog) {
// 	// 	console.log(`slippage limit exceeded: ${slippageLimitExceededLog}`);

// 	// 	throw new Error(`slippage limit exceeded: ${slippageLimitExceededLog}`);
// 	// }

// 	// console.log(simulatedTransactions[0].value.logs);
// 	// console.log(simulatedTransactions[1].value.logs);

// 	// const transactionSignatures = transactions.map((tx) =>
// 	// 	tx.signatures.map((sig) => bs58.encode(sig)),
// 	// );
// 	// console.log(transactionSignatures);

// 	// const sendJitoBundleRes = await sendJitoBundle(transactions);

// 	// console.log(sendJitoBundleRes);

// 	// const jitoStatusRes = await checkJitoBundleStatus(sendJitoBundleRes.result);

// 	// console.log(jitoStatusRes.result.value);
// } catch (error) {
// 	console.log("\x1b[31m%s\x1b[0m", "failed.");
// 	// console.error(error);
// }
// // }, 5000);

