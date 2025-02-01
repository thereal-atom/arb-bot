export const WSOL_MINT = "So11111111111111111111111111111111111111112";

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
