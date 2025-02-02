import type { Wallet } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type { mintToFlashLoanDataMap } from "../utils/kamino";

export interface KaminoFlashLoanWalletData {
	wallet: Wallet;
	mintTokenAccount: PublicKey;
}

export interface KaminoFlashLoanBorrowOptions {
	amount: number;
	mint: keyof typeof mintToFlashLoanDataMap;
}

export interface KaminoFlashLoanRepayOptions {
	amount: number;
	mint: keyof typeof mintToFlashLoanDataMap;
	borrowInstructionIndex: number;
}
