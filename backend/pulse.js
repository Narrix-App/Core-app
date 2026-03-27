import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import "dotenv/config";

const operatorId = process.env.OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;

if (!operatorId || !operatorKey) {
  console.error("Missing OPERATOR_ID or OPERATOR_KEY in .env");
  process.exit(1);
}

// Initialize Hedera testnet client
const client = Client.forTestnet();
client.setOperator(operatorId, PrivateKey.fromStringDer(operatorKey));

// Create HCS Topic
console.log("Creating HCS Topic...");
const topicTx = await new TopicCreateTransaction()
  .setSubmitKey(client.operatorPublicKey)
  .setTopicMemo("Narrix NAI Score Oracle")
  .execute(client);

const topicReceipt = await topicTx.getReceipt(client);
const topicId = topicReceipt.topicId;

console.log(`\n========================================`);
console.log(`  HCS Topic Created: ${topicId}`);
console.log(`  View on HashScan: https://hashscan.io/testnet/topic/${topicId}`);
console.log(`========================================\n`);
console.log(`Paste this into frontend/index.html TOPIC_ID variable:`);
console.log(`  const TOPIC_ID = "${topicId}";\n`);
console.log(`Starting price oracle (2s interval)...\n`);

// Simulated price — random walk around a seed
let score = 5000;

setInterval(async () => {
  // Random walk: drift -150 to +150, clamped to 1000-9999
  const delta = Math.floor(Math.random() * 301) - 150;
  score = Math.max(1000, Math.min(9999, score + delta));

  const payload = JSON.stringify({
    score,
    timestamp: Date.now(),
  });

  try {
    await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(payload)
      .execute(client);

    console.log(`[${new Date().toISOString()}] Sent score: ${score}`);
  } catch (err) {
    console.error(`Failed to submit message: ${err.message}`);
  }
}, 2000);
