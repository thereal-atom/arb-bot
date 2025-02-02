import { z } from "zod";

// coerce string to number
const zodNumeric = z.string().regex(/^\d+$/).transform(Number);

const envSchema = z.object({
	RPC_URL: z.string().url(),
	JUPITER_SWAP_API_URL: z.string().url(),

	WALLET_PRIVATE_KEY: z.string(),
	WALLET_WSOL_TOKEN_ACCOUNT_ADDRESS: z.string(),

	ARB_CONFIG_ATTEMPT_INTERVAL: zodNumeric,
	ARB_CONFIG_LAMPORT_AMOUNT_SOL: zodNumeric,
	ARB_CONFIG_THRESHOLD_LAMPORTS: zodNumeric,
});

const env = envSchema.parse(process.env);

export const config = {
	rpc: {
		url: env.RPC_URL,
	},
	wallet: {
		privateKey: env.WALLET_PRIVATE_KEY,
		wsolTokenAccountAddress: env.WALLET_WSOL_TOKEN_ACCOUNT_ADDRESS,
	},
	jupiter: {
		swapApiUrl: env.JUPITER_SWAP_API_URL,
	},
	arbConfig: {
		attemptInterval: env.ARB_CONFIG_ATTEMPT_INTERVAL,
		lamportAmountSol: env.ARB_CONFIG_LAMPORT_AMOUNT_SOL,
		thresholdLamports: env.ARB_CONFIG_THRESHOLD_LAMPORTS,
	},
};
