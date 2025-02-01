import { config } from "./../config/index";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import type { VersionedTransaction } from "@solana/web3.js";

interface JitoResponse<ResultType extends string | string[]> {
	jsonrpc: "2.0";
	result: ResultType;
	id: 1;
}

const sendJitoRequest = async (
	endpoint:
		| "/api/v1/bundles"
		| "/api/v1/transaction"
		| "/api/v1/getInflightBundleStatuses",
	method: "sendBundle" | "sendTransaction" | "getInflightBundleStatuses",
	params: (string | string[])[],
) => {
	const jitoResponse = await fetch(`${config.rpc.url}${endpoint}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			id: 1,
			jsonrpc: "2.0",
			method,
			params,
		}),
	});

	if (!jitoResponse.ok || !jitoResponse.body) {
		console.error(jitoResponse);

		throw new Error(
			`[jito fetch][${method} @ ${endpoint} w/ ${JSON.stringify(params)}] Failed to send transactions`,
		);
	}

	const data = await jitoResponse.json();

	return data;
};

export const sendJitoTransaction = async (
	transaction: VersionedTransaction,
): Promise<JitoResponse<"string">> => {
	const jitoTransactionResponse = await sendJitoRequest(
		"/api/v1/transaction",
		"sendTransaction",
		[bs58.encode(transaction.serialize())],
	);

	return jitoTransactionResponse;
};

export const sendJitoBundle = async (
	transactions: VersionedTransaction[],
): Promise<JitoResponse<"string">> => {
	const jitoBundleResponse = await sendJitoRequest(
		"/api/v1/bundles",
		"sendBundle",
		[transactions.map((tx) => bs58.encode(tx.serialize())), "ny"],
	);

	return jitoBundleResponse;
};

export const checkJitoBundleStatus = async (
	bundleId: string,
): Promise<JitoResponse<"string">> => {
	const jitoBundleStatusResponse = await sendJitoRequest(
		"/api/v1/getInflightBundleStatuses",
		"getInflightBundleStatuses",
		[[bundleId]],
	);

	return jitoBundleStatusResponse;
};
