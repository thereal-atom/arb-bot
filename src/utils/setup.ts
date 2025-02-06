import type { Database } from "../db/database.types";
import { createJupiterApiClient } from "@jup-ag/api";
import { initRpcConnection } from "./solana";
import { config } from "../config";
import { Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

type LogLevel = Database["public"]["Enums"]["log_level"];
type LogCtx = Database["public"]["Tables"]["log"]["Insert"]["ctx"];

export const setup = () => {
	console.log("setting up arb bot...");

	const connection = initRpcConnection(config.rpc.url);

	const jupiter = createJupiterApiClient({
		basePath: config.jupiter.swapApiUrl,
	});

	const wallet = new Wallet(
		Keypair.fromSecretKey(bs58.decode(config.wallet.privateKey)),
	);

	const supabase = createClient<Database>(
		config.supabase.url,
		config.supabase.secretKey,
	);

	const saveLog = async (level: LogLevel, message: string, ctx: LogCtx) => {
		if (false) {
			await supabase.from("log").insert({
				level,
				message,
				ctx,
			});
		} else {
			console.log(`[${level}] dev - ${message}`);
		}
	};

	const logtail = {
		success: (message: string, ctx: LogCtx) => saveLog("success", message, ctx),
		info: (message: string, ctx: LogCtx) => saveLog("info", message, ctx),
		warn: (message: string, ctx: LogCtx) => saveLog("warn", message, ctx),
		error: (message: string, ctx: LogCtx) => saveLog("error", message, ctx),
	};

	return {
		connection,
		jupiter,
		wallet,
		config,
		logtail,
	};
};
