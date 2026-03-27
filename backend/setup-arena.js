import {
  Client,
  PrivateKey,
  AccountId,
  AccountAllowanceApproveTransaction,
} from "@hashgraph/sdk";
import "dotenv/config";

const operatorId = process.env.OPERATOR_ID;
const operatorKey = PrivateKey.fromStringDer(process.env.OPERATOR_KEY);
const nrxTokenId = process.env.NRX_TOKEN_ID;
const fliparenaId = process.env.FLIPARENA_ID;

if (!nrxTokenId || !fliparenaId) {
  console.error(
    "Missing NRX_TOKEN_ID or FLIPARENA_ID in .env.\n" +
      "Run create-nrx.js and deploy.mjs first."
  );
  process.exit(1);
}

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

const operatorEvmAddress =
  "0x" + AccountId.fromString(operatorId).toSolidityAddress();

console.log("Setting up FlipArena...\n");
console.log(`Operator:  ${operatorId} (${operatorEvmAddress})`);
console.log(`NRX Token: ${nrxTokenId}`);
console.log(`Contract:  ${fliparenaId}\n`);

// Approve FlipArena to spend 10,000 NRX from operator (2 decimals → 1,000,000 units)
console.log("Approving FlipArena to spend 10,000 NRX from operator...");
const allowanceTx = await new AccountAllowanceApproveTransaction()
  .approveTokenAllowance(nrxTokenId, operatorId, fliparenaId, 10_000_00)
  .execute(client);

const allowanceReceipt = await allowanceTx.getReceipt(client);
console.log(`Allowance status: ${allowanceReceipt.status}\n`);

console.log("========================================");
console.log("  Setup Complete!");
console.log("  FlipArena can spend up to 10,000 NRX");
console.log("  from the operator account.");
console.log("========================================\n");
console.log("You can now run: npm start");

process.exit(0);
