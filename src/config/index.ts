import { z } from "zod";

const envSchema = z.object({
	RPC_URL: z.string().url(),
	WALLET_PRIVATE_KEY: z.string(),
	JUPITER_SWAP_API_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

export const config = {
	rpc: {
		url: env.RPC_URL,
	},
	wallet: {
		privateKey: env.WALLET_PRIVATE_KEY,
	},
	jupiter: {
		swapApiUrl: env.JUPITER_SWAP_API_URL,
	},
};
