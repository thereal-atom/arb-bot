import { PublicKey } from "@solana/web3.js";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const SYSTEM_SYSVAR_INFO = new PublicKey(
	"Sysvar1nstructions1111111111111111111111111",
);
export const SYSTEM_TOKEN_PROGRAM_ID = new PublicKey(
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

export const trackPerformance = (initialEventName: string) => {
	const events: Map<string, number> = new Map();

	const startTimestamp = Date.now();

	console.log(
		`[${new Date().toLocaleTimeString()}] ${initialEventName}: starting at ${startTimestamp}...`,
	);

	events.set("start", startTimestamp);

	return {
		event: (eventName: string) => {
			events.set(eventName, Date.now());

			console.log(
				`[${new Date().toLocaleTimeString()}] ${eventName}: ${Date.now() - startTimestamp}ms since start.`,
			);
		},
	};
};

export const getRandomNumber = (min: number, max: number): number => {
	return Math.floor(Math.random() * (max - min)) + min;
};
