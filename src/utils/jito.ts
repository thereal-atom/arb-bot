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
	"http://ss762057:wANx4aIa4f@154.3.209.10:7643",
	"http://ss375590:MjzilvczlD@154.3.209.100:10392",
	"http://ss311139:TthYoPiNey@154.3.209.101:1842",
	"http://ss691310:VMMHtUkNyT@154.3.209.102:6687",
	"http://ss184423:naYSXaNZHT@154.3.209.103:8011",
	"http://ss510793:zPkKIuqfrQ@154.3.209.104:8925",
	"http://ss803033:SCPdSy5Cpn@154.3.209.105:3873",
	"http://ss311139:TthYoPiNey@154.3.209.106:5485",
	"http://ss475266:PFsYgQ4ivH@154.3.209.107:10781",
	"http://ss408458:VUgnLuMZGT@154.3.209.108:7266",
	"http://ss521976:JLT3iDMhnb@154.3.209.109:7832",
	"http://ss133806:LuTkYZ7MJn@154.3.209.11:5880",
	"http://ss324206:kLje1upalH@154.3.209.110:7474",
	"http://ss445364:rnavCgFgE5@154.3.209.111:5155",
	"http://ss454398:wwfEJMQjVb@154.3.209.112:3324",
	"http://ss762057:wANx4aIa4f@154.3.209.113:1896",
	"http://ss691310:VMMHtUkNyT@154.3.209.114:9293",
	"http://ss393760:ESFhtUjGod@154.3.209.115:1659",
	"http://ss243908:0UlVrlgYm8@154.3.209.116:7401",
	"http://ss510793:zPkKIuqfrQ@154.3.209.117:2362",
	"http://ss408458:VUgnLuMZGT@154.3.209.118:2156",
	"http://ss475266:PFsYgQ4ivH@154.3.209.119:2554",
	"http://ss956884:Azh85ZYo2p@154.3.209.12:5044",
	"http://ss311139:TthYoPiNey@154.3.209.120:3294",
	"http://ss725674:zPkaTWutwW@154.3.209.121:3288",
	"http://ss803033:SCPdSy5Cpn@154.3.209.122:1901",
	"http://ss964484:dDdyUkp5OL@154.3.209.123:9288",
	"http://ss184423:naYSXaNZHT@154.3.209.124:1168",
	"http://ss243908:0UlVrlgYm8@154.3.209.125:1541",
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
