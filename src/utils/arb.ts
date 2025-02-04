import {
	ComputeBudgetProgram,
	type Connection,
	PublicKey,
	SystemProgram,
	type TransactionInstruction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import { WSOL_MINT } from "./common";
import {
	type CustomJupiterQuote,
	getJupiterSwapQuote,
	type JupiterApiClient,
} from "./jupiter";
import type {
	Instruction,
	QuoteResponse,
	SwapInstructionsResponse,
} from "@jup-ag/api";
import type { Wallet } from "@coral-xyz/anchor";
import {
	constructSolendFlashLoanBorrowInstruction,
	constructSolendFlashLoanRepayInstruction,
} from "./solend";
import type {
	SolendFlashLoanBorrowInstructionOptions,
	SolendFlashLoanInstructionWalletData,
	SolendFlashLoanRepayInstructionOptions,
} from "../types/solend";
import {
	constructKaminoFlashLoanBorrowInstruction,
	constructKaminoFlashLoanRepayInstruction,
} from "./kamino";
import type {
	ParsedInnerInstruction,
	ParsedInstruction,
} from "@solana/web3.js";

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

	const outAmount = String(Number.parseInt(reverseQuote.inAmount) + jitoTip);

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

export const constructArbitrageTransaction = async (
	connection: Connection,
	wallet: Wallet,
	jupiterSwapInstructions: SwapInstructionsResponse & {
		computeUnitLimit: number;
	},
	flashLoanInstructionData: {
		borrowInstructionData: {
			walletData: Omit<SolendFlashLoanInstructionWalletData, "wallet">;
			options: SolendFlashLoanBorrowInstructionOptions;
		};
		repayInstructionData: {
			walletData: Omit<SolendFlashLoanInstructionWalletData, "wallet">;
			options: Omit<
				SolendFlashLoanRepayInstructionOptions,
				"borrowInstructionIndex"
			>;
		};
	},
	jitoTip: number,
	flashLoanType: "kamino" | "solend" | "none" = "kamino",
) => {
	const instructions = jupiterSwapInstructions;

	let ixs: TransactionInstruction[] = [];

	const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
		units: 500_000,
	});
	// console.log(`compute unit limit is ${instructions.computeUnitLimit} CUs`);
	ixs.push(computeUnitLimitInstruction);

	// const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
	// 	microLamports: 100_000,
	// });
	// ixs.push(addPriorityFee);

	const setupInstructions =
		instructions.setupInstructions.map(instructionFormat);
	ixs = ixs.concat(setupInstructions);

	const borrowInstructionIndex = ixs.length;

	if (flashLoanType === "kamino") {
		const borrowInstruction = constructKaminoFlashLoanBorrowInstruction(
			{
				wallet,
				...flashLoanInstructionData.borrowInstructionData.walletData,
			},
			flashLoanInstructionData.borrowInstructionData.options,
		);
		ixs.push(borrowInstruction);
	}

	if (flashLoanType === "solend") {
		const borrowInstruction = constructSolendFlashLoanBorrowInstruction(
			{
				wallet,
				...flashLoanInstructionData.borrowInstructionData.walletData,
			},
			flashLoanInstructionData.borrowInstructionData.options,
		);
		ixs.push(borrowInstruction);
	}

	const swapInstructions = instructionFormat(instructions.swapInstruction);
	ixs.push(swapInstructions);

	if (flashLoanType === "kamino") {
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
	}

	if (flashLoanType === "solend") {
		const repayInstruction = constructSolendFlashLoanRepayInstruction(
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
	}

	const tipInstruction = SystemProgram.transfer({
		fromPubkey: wallet.payer.publicKey,
		toPubkey: new PublicKey(
			jitoTipAccountAddresses[
				Math.floor(Math.random() * jitoTipAccountAddresses.length)
			],
		),
		lamports: jitoTip,
	});
	ixs.push(tipInstruction);

	const addressLookupTableAccounts = await Promise.all(
		instructions.addressLookupTableAddresses.map(async (address: string) => {
			const result = await connection.getAddressLookupTable(
				new PublicKey(address),
			);
			return result.value;
		}),
	);

	const { blockhash } = await connection.getLatestBlockhash();
	console.log(`blockhash: ${blockhash}`);
	const messageV0 = new TransactionMessage({
		payerKey: wallet.payer.publicKey,
		recentBlockhash: blockhash,
		instructions: ixs,
	}).compileToV0Message(
		addressLookupTableAccounts.filter((account) => account !== null),
	);

	const transaction = new VersionedTransaction(messageV0);
	transaction.sign([wallet.payer]);

	// https://solana.com/developers/cookbook/transactions/optimize-compute

	return transaction;
};

// const simulateTransaction = async (transaction) => {
//     const simulateResponse = await connection.simulateTransaction(transaction, {
// 		commitment: "confirmed",
// 		replaceRecentBlockhash: true,
// 		innerInstructions: true,
// 	});

// 	if (blockhash !== simulateResponse.value.replacementBlockhash.blockhash) {
// 		throw new Error(
// 			`blockhash mismatch. original blockhash: ${blockhash}, replacement blockhash: ${simulateResponse.value.replacementBlockhash.blockhash}`,
// 		);
// 	}

// 	const simulatedSwapInstruction = (
// 		simulateResponse.value as typeof simulateResponse.value & {
// 			innerInstructions: ParsedInnerInstruction[];
// 		}
// 	).innerInstructions.find((ix) => ix.index === swapInstructionIndex);

// 	if (!simulatedSwapInstruction) {
// 		throw new Error("no simulated swap instruction found");
// 	}

// 	const simulatedSwapInstructionInnerInstructions =
// 		simulatedSwapInstruction?.instructions;

// 	const transferInstructions = simulatedSwapInstructionInnerInstructions.filter(
// 		(ix) =>
// 			ix.programId.toBase58() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
// 	) as ParsedInstruction[];

// 	transferInstructions.forEach(console.log);

// 	const instructionsWithWsolSource = transferInstructions.filter(
// 		(ix) =>
// 			ix.parsed.info.source === "9aiAdnqJVmw5jHBjEHv6P6cCadTFK6iwwSFKQcDq7W9q",
// 	);
// 	const instructionsWithWsolDestination = transferInstructions.filter(
// 		(ix) =>
// 			ix.parsed.info.destination ===
// 			"9aiAdnqJVmw5jHBjEHv6P6cCadTFK6iwwSFKQcDq7W9q",
// 	);

// 	if (
// 		instructionsWithWsolSource.length !== 1 ||
// 		instructionsWithWsolDestination.length !== 1
// 	) {
// 		throw new Error(
// 			`no wsol transfer instructions found. found ${instructionsWithWsolSource.length} ixs with wsol source. found ${instructionsWithWsolDestination.length} ixs with wsol destination.`,
// 		);
// 	}

// 	const startTransferInstruction = instructionsWithWsolSource[0];
// 	const endTransferInstruction = instructionsWithWsolDestination[0];

// 	if (!startTransferInstruction) {
// 		throw new Error("no start transfer instruction found");
// 	}

// 	if (!endTransferInstruction) {
// 		throw new Error("no end transfer instruction found");
// 	}

// 	const simulatedInputAmount =
// 		"tokenAmount" in startTransferInstruction.parsed.info
// 			? startTransferInstruction.parsed.info.tokenAmount.amount
// 			: startTransferInstruction.parsed.info.amount;
// 	const simulatedOutputAmount =
// 		"tokenAmount" in endTransferInstruction.parsed.info
// 			? endTransferInstruction.parsed.info.tokenAmount.amount
// 			: endTransferInstruction.parsed.info.amount;

// 	if (!simulatedInputAmount) {
// 		console.log(startTransferInstruction);

// 		throw new Error("no simulated input amount found");
// 	}

// 	if (!simulatedOutputAmount) {
// 		console.log(endTransferInstruction);

// 		throw new Error("no simulated output amount found");
// 	}

// 	console.log(
// 		`simulated flow: ${simulatedInputAmount} -> ${simulatedOutputAmount}`,
// 	);

// 	console.log(Number.parseInt(simulatedOutputAmount));
// 	console.log(Number.parseInt(simulatedInputAmount));

// 	if (
// 		Number.parseInt(simulatedOutputAmount) <
// 		Number.parseInt(simulatedInputAmount)
// 	) {
// 		throw new Error("losing trade");
// 	}
// };
