import type { VersionedTransaction } from "@solana/web3.js";
import type { CustomJupiterQuote } from "./jupiter";
import fs from "node:fs";
import { randomUUIDv7 } from "bun";

export interface Log {
	id: string;
	timestamp: number;
	quotes?: {
		quote: {
			fetchedAt: number;
			quote: CustomJupiterQuote;
		};
		reverseQuote: {
			fetchedAt: number;
			quote: CustomJupiterQuote;
		};
	};
	inAmountLamports?: number;
	calculatedProfitLamports?: number;
	calculatedJitoTip?: number;
	jupiterSwapTransactionInstructions?: {
		fetchedAt: number;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		instructions: any;
	};
	transaction?: {
		fetchedAt: number;
		transaction: VersionedTransaction;
	};
	jtioBundle?: {
		fetchedAt: number;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		bundle: any;
	};
	errorLogs: string[];
}

export const saveLog = (log: Log) => {
	const doesLogFileExist = fs.existsSync("./logs.json");

	if (!doesLogFileExist) {
		fs.writeFileSync("./logs.json", JSON.stringify([log], null, 4));

		return;
	}

	const logs = JSON.parse(fs.readFileSync("./logs.json", "utf-8"));

	logs.push(log);

	fs.writeFileSync("./logs.json", JSON.stringify(logs, null, 4));
};

export const createLog = () => {
	const log: Log = {
		id: randomUUIDv7(),
		timestamp: Date.now(),
		errorLogs: [],
	};

	return log;
};
