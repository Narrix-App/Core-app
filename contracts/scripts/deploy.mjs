import {
  Client,
  PrivateKey,
  ContractCreateFlow,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { readFileSync, appendFileSync } from "fs";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../backend/.env") });

const operatorId = process.env.OPERATOR_ID;
const operatorKey = PrivateKey.fromStringDer(process.env.OPERATOR_KEY);
const nrxEvmAddress = process.env.NRX_TOKEN_EVM;

if (!nrxEvmAddress) {
  console.error("NRX_TOKEN_EVM not set. Run `node create-nrx.js` in backend/ first.");
  process.exit(1);
}

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

// Read Hardhat-compiled artifact
const artifactPath = resolve(
  __dirname,
  "../artifacts/contracts/FlipArena.sol/FlipArena.json"
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

console.log("Deploying FlipArena to Hedera Testnet...");
console.log(`NRX Token EVM: ${nrxEvmAddress}\n`);

// Deploy via Hedera SDK (gives us maxAutomaticTokenAssociations)
const tx = new ContractCreateFlow()
  .setBytecode(artifact.bytecode)
  .setConstructorParameters(
    new ContractFunctionParameters().addAddress(
      nrxEvmAddress.replace("0x", "")
    )
  )
  .setMaxAutomaticTokenAssociations(10)
  .setGas(800_000);

const response = await tx.execute(client);
const receipt = await response.getReceipt(client);

const contractId = receipt.contractId;
const contractEvmAddress = "0x" + contractId.toSolidityAddress();

console.log("========================================");
console.log("  FlipArena Deployed!");
console.log(`  Contract ID:  ${contractId}`);
console.log(`  EVM Address:  ${contractEvmAddress}`);
console.log(`  HashScan:     https://hashscan.io/testnet/contract/${contractId}`);
console.log("========================================\n");

// Append to backend/.env
const envPath = resolve(__dirname, "../../backend/.env");
appendFileSync(
  envPath,
  `FLIPARENA_ID=${contractId}\nFLIPARENA_EVM=${contractEvmAddress}\n`
);
console.log("Appended FLIPARENA_ID and FLIPARENA_EVM to backend/.env");

process.exit(0);
