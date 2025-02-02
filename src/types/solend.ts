import type { Wallet } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type { mintToFlashLoanDataMap } from "../utils/solend";

export interface SolendFlashLoanInstructionWalletData {
	wallet: Wallet;
	mintTokenAccount: PublicKey;
}

export interface SolendFlashLoanBorrowInstructionOptions {
	amount: number;
	mint: keyof typeof mintToFlashLoanDataMap;
}

export interface SolendFlashLoanRepayInstructionOptions {
	amount: number;
	mint: keyof typeof mintToFlashLoanDataMap;
	borrowInstructionIndex: number;
}
