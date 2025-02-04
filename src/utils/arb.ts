import {
	type Connection,
	type TransactionInstruction,
	type Blockhash,
	type ParsedInnerInstruction,
	type ParsedInstruction,
	Keypair,
	ComputeBudgetProgram,
	PublicKey,
	SystemProgram,
	TransactionMessage,
	VersionedTransaction,
	Transaction,
} from "@solana/web3.js";
import type { Wallet } from "@coral-xyz/anchor";
import type {
	Instruction,
	QuoteResponse,
	SwapInstructionsResponse,
} from "@jup-ag/api";
import { WSOL_MINT } from "./common";
import type {
	KaminoFlashLoanBorrowOptions,
	KaminoFlashLoanRepayOptions,
	KaminoFlashLoanWalletData,
} from "../types/kamino";
import {
	constructKaminoFlashLoanBorrowInstruction,
	constructKaminoFlashLoanRepayInstruction,
} from "./kamino";
import {
	type CustomJupiterQuote,
	type JupiterApiClient,
	getJupiterSwapQuote,
} from "./jupiter";
import { getSimulationComputeUnits } from "@solana-developers/helpers";

const jitoTipAccountAddresses = [
	"96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
	"ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
	"DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
	"3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
	"DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
	"Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
	"ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
	"HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
];

export const getArbitrageQuotes = async (
	jupiter: JupiterApiClient,
	options: {
		mintB: string;
		uiAmountSol: number;
	},
) => {
	const quote = await getJupiterSwapQuote(jupiter, {
		inputMint: WSOL_MINT,
		outputMint: options.mintB,
		amount: options.uiAmountSol * 10 ** 9,
	});

	const reverseQuote = await getJupiterSwapQuote(jupiter, {
		inputMint: options.mintB,
		outputMint: WSOL_MINT,
		amount: quote.outAmount,
	});

	return {
		quote,
		reverseQuote,
	};
};

export const combineQuotes = (
	quote: QuoteResponse,
	reverseQuote: QuoteResponse,
) => {
	const combinedQuote = quote;

	const jitoTip = Math.floor(
		(Number.parseFloat(reverseQuote.outAmount) -
			Number.parseFloat(quote.inAmount)) /
			2,
	);

	const outAmount = String(Number.parseInt(quote.inAmount) + jitoTip);

	combinedQuote.outAmount = outAmount;
	combinedQuote.otherAmountThreshold = outAmount;
	// combinedQuote.outputMint = quote.inputMint;
	combinedQuote.priceImpactPct = "0";
	combinedQuote.routePlan = quote.routePlan.concat(reverseQuote.routePlan);

	return combinedQuote;
};

export const getQuoteProfit = (
	quote: CustomJupiterQuote,
	reverseQuote: CustomJupiterQuote,
) => {
	const profitLamports = reverseQuote.outAmount - quote.inAmount;
	const profitPercent = (profitLamports / quote.inAmount) * 100;

	return {
		profitLamports,
		profitPercent,
	};
};

const instructionFormat = (instruction: Instruction) => {
	return {
		programId: new PublicKey(instruction.programId),
		keys: instruction.accounts.map((account) => ({
			pubkey: new PublicKey(account.pubkey),
			isSigner: account.isSigner,
			isWritable: account.isWritable,
		})),
		data: Buffer.from(instruction.data, "base64"),
	};
};

export const createTipWallet = async (
	connection: Connection,
	fromWallet: Keypair,
) => {
	const tipWallet = new Keypair();

	// const space = 0;
	// const rentExemptionAmount =
	// 	await connection.getMinimumBalanceForRentExemption(space);

	// const createAccountParams = {
	// 	fromPubkey: fromWallet.publicKey,
	// 	newAccountPubkey: tipWallet.publicKey,
	// 	lamports: rentExemptionAmount,
	// 	space,
	// 	programId: SystemProgram.programId,
	// };

	// const createTipAccountInstruction =
	// 	SystemProgram.createAccount(createAccountParams);

	return {
		// createTipAccountInstruction,
		tipWallet,
	};
};

export const constructArbitrageTransaction = async (
	connection: Connection,
	wallet: Wallet,
	jupiterSwapInstructions: SwapInstructionsResponse & {
		computeUnitLimit: number;
	},
	flashLoanInstructionData: {
		borrowInstructionData: {
			walletData: Omit<KaminoFlashLoanWalletData, "wallet">;
			options: KaminoFlashLoanBorrowOptions;
		};
		repayInstructionData: {
			walletData: Omit<KaminoFlashLoanWalletData, "wallet">;
			options: Omit<KaminoFlashLoanRepayOptions, "borrowInstructionIndex">;
		};
	},
	tipData: {
		jitoTip: number;
	},
) => {
	const instructions = jupiterSwapInstructions;

	let ixs: TransactionInstruction[] = [];

	// const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
	// 	units: 500_000,
	// });
	// console.log(`compute unit limit is ${instructions.computeUnitLimit} CUs`);
	// ixs.push(computeUnitLimitInstruction);

	const setupInstructions =
		instructions.setupInstructions.map(instructionFormat);
	ixs = ixs.concat(setupInstructions);

	const borrowInstructionIndex = ixs.length;

	const borrowInstruction = constructKaminoFlashLoanBorrowInstruction(
		{
			wallet,
			...flashLoanInstructionData.borrowInstructionData.walletData,
		},
		flashLoanInstructionData.borrowInstructionData.options,
	);
	ixs.push(borrowInstruction);

	const swapInstructions = instructionFormat(instructions.swapInstruction);
	ixs.push(swapInstructions);

	// const swapInstructionIndex = ixs.length - 1;

	const repayInstruction = constructKaminoFlashLoanRepayInstruction(
		{
			wallet,
			...flashLoanInstructionData.repayInstructionData.walletData,
		},
		{
			...flashLoanInstructionData.repayInstructionData.options,
			borrowInstructionIndex,
		},
	);
	ixs.push(repayInstruction);

	const {
		// createTipAccountInstruction,
		tipWallet,
	} = await createTipWallet(connection, wallet.payer);
	// ixs.push(createTipAccountInstruction);

	console.log(`tipping from ${tipWallet.publicKey.toBase58()}`);

	console.log(`tip is ${tipData.jitoTip}`);

	const minimumAmount = await connection.getMinimumBalanceForRentExemption(0);

	console.log(`minimumAmount is ${minimumAmount}`);

	const sendAmount =
		tipData.jitoTip > minimumAmount
			? tipData.jitoTip
			: minimumAmount + tipData.jitoTip;

	console.log(`sendAmount is ${sendAmount}`);

	const sendTipToTippingWalletIx = SystemProgram.transfer({
		fromPubkey: wallet.payer.publicKey,
		toPubkey: tipWallet.publicKey,
		lamports: sendAmount + 5_000,
	});
	ixs.push(sendTipToTippingWalletIx);

	// const tipInstruction = SystemProgram.transfer({
	// 	fromPubkey: wallet.payer.publicKey,
	// 	toPubkey: new PublicKey(
	// 		jitoTipAccountAddresses[
	// 			Math.floor(Math.random() * jitoTipAccountAddresses.length)
	// 		],
	// 	),
	// 	lamports: tipData.jitoTip,
	// });
	// ixs.push(tipInstruction);

	const addressLookupTableAccounts = await Promise.all(
		instructions.addressLookupTableAddresses.map(async (address: string) => {
			const result = await connection.getAddressLookupTable(
				new PublicKey(address),
			);
			return result.value;
		}),
	);

	const { blockhash } = await connection.getLatestBlockhash();

	const simulationComputeUnits = await getSimulationComputeUnits(
		connection,
		ixs,
		wallet.payer.publicKey,
		addressLookupTableAccounts.filter((account) => account !== null),
	);

	if (simulationComputeUnits) {
		ixs.unshift(
			ComputeBudgetProgram.setComputeUnitLimit({
				units: simulationComputeUnits * 1.1,
			}),
		);
	}

	const messageV0 = new TransactionMessage({
		payerKey: wallet.payer.publicKey,
		recentBlockhash: blockhash,
		instructions: ixs,
	}).compileToV0Message(
		addressLookupTableAccounts.filter((account) => account !== null),
	);

	const transaction = new VersionedTransaction(messageV0);
	transaction.sign([wallet.payer]);

	// await simulateTransaction(connection, transaction, swapInstructionIndex);

	return {
		arbTransaction: transaction,
		blockhash,
		tipWallet,
		minimumAmount,
	};
};

export const constructTipTransaction = (
	options: {
		amount: number;
		wallet: Keypair;
		minimumAmount: number;
	},
	blockhash: Blockhash,
	mainWallet: Wallet,
) => {
	const transaction = new Transaction();

	const jitoTipWallet = new PublicKey(
		jitoTipAccountAddresses[
			Math.floor(Math.random() * jitoTipAccountAddresses.length)
		],
	);

	console.log(`sending tip to ${jitoTipWallet.toBase58()}`);

	const tipInstruction = SystemProgram.transfer({
		fromPubkey: options.wallet.publicKey,
		toPubkey: jitoTipWallet,
		lamports: options.amount,
	});

	const returnMinimumAmountInstruction = SystemProgram.transfer({
		fromPubkey: options.wallet.publicKey,
		toPubkey: mainWallet.publicKey,
		lamports: options.minimumAmount,
	});

	transaction.add(tipInstruction, returnMinimumAmountInstruction);

	transaction.recentBlockhash = blockhash;
	transaction.sign(options.wallet);

	return transaction;
};

const simulateTransaction = async (
	connection: Connection,
	transaction: VersionedTransaction,
	swapInstructionIndex: number,
) => {
	const simulateResponse = await connection.simulateTransaction(transaction, {
		commitment: "confirmed",
		replaceRecentBlockhash: true,
		innerInstructions: true,
	});

	if (simulateResponse.value.err) {
		console.log(simulateResponse.value.err);
		console.log(simulateResponse.value.logs);

		throw new Error("error simulating tx");
	}

	const simulatedSwapInstruction = (
		simulateResponse.value as typeof simulateResponse.value & {
			innerInstructions: ParsedInnerInstruction[];
		}
	).innerInstructions.find((ix) => ix.index === swapInstructionIndex);

	if (!simulatedSwapInstruction) {
		throw new Error("no simulated swap instruction found");
	}

	const simulatedSwapInstructionInnerInstructions =
		simulatedSwapInstruction?.instructions;

	const transferInstructions = simulatedSwapInstructionInnerInstructions.filter(
		(ix) =>
			ix.programId.toBase58() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
	) as ParsedInstruction[];

	// transferInstructions.forEach(console.log);

	const instructionsWithWsolSource = transferInstructions.filter(
		(ix) =>
			ix.parsed.info.source === "9aiAdnqJVmw5jHBjEHv6P6cCadTFK6iwwSFKQcDq7W9q",
	);
	const instructionsWithWsolDestination = transferInstructions.filter(
		(ix) =>
			ix.parsed.info.destination ===
			"9aiAdnqJVmw5jHBjEHv6P6cCadTFK6iwwSFKQcDq7W9q",
	);

	if (
		instructionsWithWsolSource.length !== 1 ||
		instructionsWithWsolDestination.length !== 1
	) {
		throw new Error(
			`no wsol transfer instructions found. found ${instructionsWithWsolSource.length} ixs with wsol source. found ${instructionsWithWsolDestination.length} ixs with wsol destination.`,
		);
	}

	const startTransferInstruction = instructionsWithWsolSource[0];
	const endTransferInstruction = instructionsWithWsolDestination[0];

	if (!startTransferInstruction) {
		throw new Error("no start transfer instruction found");
	}

	if (!endTransferInstruction) {
		throw new Error("no end transfer instruction found");
	}

	const simulatedInputAmount =
		"tokenAmount" in startTransferInstruction.parsed.info
			? startTransferInstruction.parsed.info.tokenAmount.amount
			: startTransferInstruction.parsed.info.amount;
	const simulatedOutputAmount =
		"tokenAmount" in endTransferInstruction.parsed.info
			? endTransferInstruction.parsed.info.tokenAmount.amount
			: endTransferInstruction.parsed.info.amount;

	if (!simulatedInputAmount) {
		console.log(startTransferInstruction);

		throw new Error("no simulated input amount found");
	}

	if (!simulatedOutputAmount) {
		console.log(endTransferInstruction);

		throw new Error("no simulated output amount found");
	}

	console.log(
		`simulated flow: ${simulatedInputAmount} -> ${simulatedOutputAmount}`,
	);

	if (
		Number.parseInt(simulatedOutputAmount) <
		Number.parseInt(simulatedInputAmount)
	) {
		throw new Error("losing trade");
	}
};
