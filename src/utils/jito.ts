import type { VersionedTransaction, Transaction } from "@solana/web3.js";
import { config } from "./../config/index";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

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
	const jitoResponse = await fetch(`${config.jito.url}${endpoint}`, {
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

const proxyUrls = [
	"http://ss464995:hKAyzXfFU5@154.3.209.249:9163",
	"http://ss568497:b1uJuVM5tH@154.3.209.25:2609",
	"http://ss385755:bkz2UYAupV@154.3.209.250:4332",
	"http://ss587211:b0qTyPf12g@154.3.209.251:9861",
	"http://ss849101:dlQa8rzsqv@154.3.209.252:7691",
	"http://ss849101:dlQa8rzsqv@154.3.209.253:7880",
	"http://ss849101:dlQa8rzsqv@154.3.209.254:3721",
	"http://ss238162:o2Xnctqf4b@154.3.209.26:5092",
	"http://ss803228:FGM6oD7Cnn@154.3.209.27:8356",
	"http://ss994972:GRwG8PKMVQ@154.3.209.28:3225",
	"http://ss522719:REuuYZ8wJR@154.3.209.29:9550",
	"http://ss863349:pO69uxECmZ@154.3.209.3:8087",
	"http://ss964984:4fyZmvmlaQ@154.3.209.30:1087",
	"http://ss785153:GTz1Hbn4Zk@154.3.209.31:7840",
	"http://ss176599:5yG77YAx5o@154.3.209.32:4231",
	"http://ss836046:68UVi1oWTK@154.3.209.33:3958",
	"http://ss442292:1mhNdegBxB@154.3.209.34:1238",
	"http://ss208362:2adO9x8Znu@154.3.209.35:10622",
	"http://ss785153:GTz1Hbn4Zk@154.3.209.36:8537",
	"http://ss305294:jmccBUXOOd@154.3.209.37:8549",
	"http://ss803228:FGM6oD7Cnn@154.3.209.38:2116",
	"http://ss863349:pO69uxECmZ@154.3.209.39:10034",
	"http://ss801908:hA8RwbZJCh@154.3.209.4:10677",
	"http://ss385755:bkz2UYAupV@154.3.209.40:2002",
	"http://ss452971:8Sc0YI817m@154.3.209.41:2261",
	"http://ss994972:GRwG8PKMVQ@154.3.209.42:3760",
	"http://ss695346:7VXmgXhJVP@154.3.209.43:2118",
	"http://ss143752:bEp5xcV5Dx@154.3.209.44:4527",
	"http://ss385755:bkz2UYAupV@154.3.209.45:8460",
];

// let i = 0;

export const sendJitoBundle = async (
	transactions: (VersionedTransaction | Transaction)[],
): Promise<JitoResponse<"string">> => {
	const res = await fetch(
		"https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles",
		// config.jito.url,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: 1,
				jsonrpc: "2.0",
				method: "sendBundle",
				params: [transactions.map((tx) => bs58.encode(tx.serialize()))],
			}),
			proxy: proxyUrls[Math.floor(Math.random() * proxyUrls.length)],
		},
	);

	// if (i >= proxyUrls.length - 1) {
	// 	i = 0;
	// } else {
	// 	i++;
	// }

	if (!res.ok) {
		console.log(res);

		throw new Error("failed to send bundle");
	}

	const data = await res.json();

	return data;
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
