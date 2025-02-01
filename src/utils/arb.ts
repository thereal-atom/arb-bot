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

	combinedQuote.outAmount = String(
		Number.parseFloat(quote.inAmount) +
			Number.parseFloat(reverseQuote.outAmount),
	);
	combinedQuote.otherAmountThreshold = String(
		Number.parseFloat(quote.inAmount) +
			Number.parseFloat(reverseQuote.outAmount),
	);
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
	jupiterSwapInstructions: SwapInstructionsResponse,
	jitoTip: number,
) => {
	const instructions = jupiterSwapInstructions;

	let ixs: TransactionInstruction[] = [];

	const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
		units: instructions.computeUnitLimit,
	});
	ixs.push(computeUnitLimitInstruction);

	const setupInstructions =
		instructions.setupInstructions.map(instructionFormat);
	ixs = ixs.concat(setupInstructions);

	const swapInstructions = instructionFormat(instructions.swapInstruction);
	ixs.push(swapInstructions);

	const tipInstruction = SystemProgram.transfer({
		fromPubkey: wallet.payer.publicKey,
		toPubkey: new PublicKey("Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY"), // a random account from jito tip accounts
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
	const messageV0 = new TransactionMessage({
		payerKey: wallet.payer.publicKey,
		recentBlockhash: blockhash,
		instructions: ixs,
	}).compileToV0Message(
		addressLookupTableAccounts.filter((account) => account !== null),
	);

	const transaction = new VersionedTransaction(messageV0);
	transaction.sign([wallet.payer]);

	return transaction;
};
