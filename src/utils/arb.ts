import {
	type Connection,
	type TransactionInstruction,
	type Blockhash,
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
	const space = 0;
	const rentExemptionAmount =
		await connection.getMinimumBalanceForRentExemption(space);

	const tipWallet = new Keypair();
	const createAccountParams = {
		fromPubkey: fromWallet.publicKey,
		newAccountPubkey: tipWallet.publicKey,
		lamports: rentExemptionAmount,
		space,
		programId: SystemProgram.programId,
	};

	const createTipAccountInstruction =
		SystemProgram.createAccount(createAccountParams);

	return {
		createTipAccountInstruction,
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

	const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
		units: 500_000,
	});
	// console.log(`compute unit limit is ${instructions.computeUnitLimit} CUs`);
	ixs.push(computeUnitLimitInstruction);

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

	const { createTipAccountInstruction, tipWallet } = await createTipWallet(
		connection,
		wallet.payer,
	);
	ixs.push(createTipAccountInstruction);

	console.log(`tipping from ${tipWallet.publicKey.toBase58()}`);

	// const minimumBalance = await connection.getMinimumBalanceForRentExemption(0);

	const tipInstruction = SystemProgram.transfer({
		fromPubkey: wallet.payer.publicKey,
		toPubkey: tipWallet.publicKey,
		lamports: tipData.jitoTip,
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

	return {
		arbTransaction: transaction,
		blockhash,
		tipWallet,
	};
};

export const constructTipTransaction = (
	options: {
		amount: number;
		wallet: Keypair;
	},
	blockhash: Blockhash,
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

	transaction.add(tipInstruction);

	transaction.recentBlockhash = blockhash;
	transaction.sign(options.wallet);

	return transaction;
};
