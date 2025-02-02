import type { TransactionInstruction } from "@solana/web3.js";
import type {
	SolendFlashLoanBorrowInstructionOptions,
	SolendFlashLoanInstructionWalletData,
	SolendFlashLoanRepayInstructionOptions,
} from "../types/solend";
import solend from "@solendprotocol/solend-sdk";
import { PublicKey } from "@solana/web3.js";
import { WSOL_MINT } from "./common";

const SOLEND_PROGRAM_ID = new PublicKey(
	"So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo",
);
const SOLEND_FEE_RECEIVER = new PublicKey(
	"5wo1tFpi4HaVKnemqaXeQnBEpezrJXcXvuztYaPhvgC7",
);

export const mintToFlashLoanDataMap = {
	[WSOL_MINT]: {
		vault: new PublicKey("5cSfC32xBUYqGfkURLGfANuK64naHmMp27jUT7LQSujY"),
		reserve: new PublicKey("UTABCRXirrbpCNDogCoqEECtM3V44jXGCsK23ZepV3Z"),
		lendingMarket: new PublicKey(
			"7RCz8wb6WXxUhAigok9ttgrVgDFFFbibcirECzWSBauM",
		),
	},
};

/**
 * Construct a Solend flash loan borrow instruction.
 *
 * @param {object} walletData - The wallet data necessary for a flash loan instruction.
 * @param {Wallet} walletData.wallet - The wallet which will be used to execute the transactions.
 * @param {PublicKey} walletData.mintTokenAccount - The token account of the mint being borrowed or repaid of the wallet.
 * @param {object} options - Options for the flash loan instruction.
 * @param {number} options.amount - The amount (in lamports/base amount) of tokens to borrow.
 * @param {keyof typeof mintToFlashLoanDataMap} options.mint - The mint of the token to borrow.
 *
 * @returns {TransactionInstruction} The constructed transaction instruction.
 */
export const constructSolendFlashLoanBorrowInstruction = (
	walletData: SolendFlashLoanInstructionWalletData,
	options: SolendFlashLoanBorrowInstructionOptions,
): TransactionInstruction => {
	const flashLoanData = mintToFlashLoanDataMap[options.mint];

	const solendFlashLoanBorrowInstruction =
		solend.flashBorrowReserveLiquidityInstruction(
			options.amount,
			flashLoanData.vault,
			walletData.mintTokenAccount,
			flashLoanData.reserve,
			flashLoanData.lendingMarket,
			SOLEND_PROGRAM_ID,
		);

	return solendFlashLoanBorrowInstruction;
};

/**
 * Construct a Solend flash loan repay instruction.
 *
 * @param {object} walletData - The wallet data necessary for a flash loan instruction.
 * @param {Wallet} walletData.wallet - The wallet which will be used to execute the transactions.
 * @param {PublicKey} walletData.mintTokenAccount - The token account of the mint being borrowed or repaid of the wallet.
 * @param {object} options - Options for the flash loan instruction.
 * @param {number} options.amount - The amount (in lamports/base amount) of tokens to repay.
 * @param {keyof typeof mintToFlashLoanDataMap} options.mint - The mint of the token to repay.
 * @param {number} options.borrowInstructionIndex - The index of the flash loan borrow instruction in the transaction.
 *
 * @returns {TransactionInstruction} The constructed transaction instruction.
 */
export const constructSolendFlashLoanRepayInstruction = (
	walletData: SolendFlashLoanInstructionWalletData,
	options: SolendFlashLoanRepayInstructionOptions,
): TransactionInstruction => {
	const flashLoanData = mintToFlashLoanDataMap[options.mint];

	const solendFlashLoanRepayInstruction =
		solend.flashRepayReserveLiquidityInstruction(
			options.amount,
			options.borrowInstructionIndex,
			walletData.mintTokenAccount,
			flashLoanData.vault,
			SOLEND_FEE_RECEIVER,
			walletData.mintTokenAccount,
			flashLoanData.reserve,
			flashLoanData.lendingMarket,
			walletData.wallet.payer.publicKey,
			SOLEND_PROGRAM_ID,
		);

	return solendFlashLoanRepayInstruction;
};
