import {
  Client,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
} from "@hashgraph/sdk";
import { appendFileSync } from "fs";
import "dotenv/config";

const operatorId = process.env.OPERATOR_ID;
const operatorKey = PrivateKey.fromStringDer(process.env.OPERATOR_KEY);

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

console.log("Creating $NRX token on Hedera Testnet...\n");

const tx = await new TokenCreateTransaction()
  .setTokenName("Narrix")
  .setTokenSymbol("NRX")
  .setDecimals(2)
  .setInitialSupply(1_000_000_00) // 1,000,000.00 NRX (2 decimals)
  .setTreasuryAccountId(operatorId)
  .setAdminKey(operatorKey.publicKey)
  .setSupplyKey(operatorKey.publicKey)
  .execute(client);

const receipt = await tx.getReceipt(client);
const tokenId = receipt.tokenId;
const evmAddress = "0x" + tokenId.toSolidityAddress();

console.log("========================================");
console.log("  $NRX Token Created!");
console.log(`  Token ID:    ${tokenId}`);
console.log(`  EVM Address: ${evmAddress}`);
console.log(`  Supply:      1,000,000.00 NRX`);
console.log(`  Decimals:    2`);
console.log(`  Treasury:    ${operatorId}`);
console.log("========================================\n");

// Append to .env
appendFileSync(
  ".env",
  `NRX_TOKEN_ID=${tokenId}\nNRX_TOKEN_EVM=${evmAddress}\n`
);
console.log("Appended NRX_TOKEN_ID and NRX_TOKEN_EVM to .env");

// Also show operator EVM address for frontend
const operatorEvmAddress = "0x" + AccountId.fromString(operatorId).toSolidityAddress();
console.log(`\nOperator EVM Address: ${operatorEvmAddress}`);
console.log("(Use this as the 'user' address for testnet betting)\n");

process.exit(0);
