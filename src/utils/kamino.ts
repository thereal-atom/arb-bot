import type {
	KaminoFlashLoanBorrowOptions,
	KaminoFlashLoanRepayOptions,
	KaminoFlashLoanWalletData,
} from "../types/kamino";
import kamino from "@kamino-finance/klend-sdk";
import { PublicKey } from "@solana/web3.js";
import {
	SYSTEM_SYSVAR_INFO,
	SYSTEM_TOKEN_PROGRAM_ID,
	WSOL_MINT,
} from "./common";
import { BN } from "@coral-xyz/anchor";

const KAMINO_LENDING_PROGRAM_ID = new PublicKey(
	"KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);
const KAMINO_LENDING_MAIN_MARKET = new PublicKey(
	"7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
);
const KAMINO_RESERVE_1 = new PublicKey(
	"9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo",
);
const KAMINO_RESERVE_LIQUIDITY_FEE_RECEIVER = new PublicKey(
	"3JNof8s453bwG5UqiXBLJc77NRQXezYYEBbk3fqnoKph",
);

export const mintToFlashLoanDataMap = {
	[WSOL_MINT]: {
		reserve: new PublicKey("d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q"),
		reserveSourceLiquidity: new PublicKey(
			"GafNuUXj9rxGLn4y79dPu6MHSuPWeJR6UtTWuexpGh3U",
		),
	},
};

export const constructKaminoFlashLoanBorrowInstruction = (
	walletData: KaminoFlashLoanWalletData,
	options: KaminoFlashLoanBorrowOptions,
) => {
	const flashLoanData = mintToFlashLoanDataMap[options.mint];

	const kaminoFlashLoanBorrowInstruction = kamino.flashBorrowReserveLiquidity(
		{
			liquidityAmount: new BN(50_000_000_000_000),
		},
		{
			userTransferAuthority: walletData.wallet.payer.publicKey,
			lendingMarketAuthority: KAMINO_RESERVE_1,
			lendingMarket: KAMINO_LENDING_MAIN_MARKET,
			reserve: flashLoanData.reserve,
			reserveLiquidityMint: new PublicKey(options.mint),
			reserveSourceLiquidity: flashLoanData.reserveSourceLiquidity,
			userDestinationLiquidity: walletData.mintTokenAccount,
			reserveLiquidityFeeReceiver: KAMINO_RESERVE_LIQUIDITY_FEE_RECEIVER,
			referrerTokenState: KAMINO_LENDING_PROGRAM_ID,
			referrerAccount: KAMINO_LENDING_PROGRAM_ID,
			sysvarInfo: SYSTEM_SYSVAR_INFO,
			tokenProgram: SYSTEM_TOKEN_PROGRAM_ID,
		},
	);

	return kaminoFlashLoanBorrowInstruction;
};

export const constructKaminoFlashLoanRepayInstruction = (
	walletData: KaminoFlashLoanWalletData,
	options: KaminoFlashLoanRepayOptions,
) => {
	const flashLoanData = mintToFlashLoanDataMap[options.mint];

	const kaminoFlashLoanRepayInstruction = kamino.flashRepayReserveLiquidity(
		{
			liquidityAmount: new BN(50_000_000_000_000),
			borrowInstructionIndex: options.borrowInstructionIndex,
		},
		{
			userTransferAuthority: walletData.wallet.payer.publicKey,
			lendingMarketAuthority: KAMINO_RESERVE_1,
			lendingMarket: KAMINO_LENDING_MAIN_MARKET,
			reserve: flashLoanData.reserve,
			reserveLiquidityMint: new PublicKey(options.mint),
			// in borrow ix this is source liquidity, in repay ix this is destination liquidity
			reserveDestinationLiquidity: flashLoanData.reserveSourceLiquidity,
			// same as above, but opposite
			userSourceLiquidity: walletData.mintTokenAccount,
			reserveLiquidityFeeReceiver: KAMINO_RESERVE_LIQUIDITY_FEE_RECEIVER,
			referrerTokenState: KAMINO_LENDING_PROGRAM_ID,
			referrerAccount: KAMINO_LENDING_PROGRAM_ID,
			sysvarInfo: SYSTEM_SYSVAR_INFO,
			tokenProgram: SYSTEM_TOKEN_PROGRAM_ID,
		},
	);

	return kaminoFlashLoanRepayInstruction;
};
