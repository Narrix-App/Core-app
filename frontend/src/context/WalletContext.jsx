import { createContext, useContext, useState, useCallback, useRef } from "react";
import { HashConnect } from "hashconnect";
import {
  LedgerId, AccountId, TokenId,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
} from "@hashgraph/sdk";

const MIRROR = "https://testnet.mirrornode.hedera.com";
const Ctx = createContext(null);
export const useWallet = () => useContext(Ctx);

export function WalletProvider({ config, children }) {
  const hcRef = useRef(null);
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | setup | ready

  const connect = useCallback(async () => {
    setStatus("connecting");
    const hc = new HashConnect(
      LedgerId.TESTNET,
      config.wcProjectId,
      { name: "Narrix Terminal", description: "30s Pulse Flip", icons: ["https://www.hashpack.app/img/logo.svg"], url: location.origin },
      false
    );
    hcRef.current = hc;

    hc.pairingEvent.on((data) => {
      const id = data.accountIds[0];
      setAccountId(id);
      setEvmAddress("0x" + AccountId.fromString(id).toSolidityAddress());
      setStatus("setup");
    });

    hc.disconnectionEvent.on(() => { setAccountId(null); setEvmAddress(null); setStatus("disconnected"); });

    await hc.init();
    await hc.openPairingModal("dark");
  }, [config]);

  const associateToken = useCallback(async (tokenId) => {
    const aid = AccountId.fromString(accountId);
    await hcRef.current.sendTransaction(aid, new TokenAssociateTransaction().setAccountId(aid).setTokenIds([TokenId.fromString(tokenId)]));
  }, [accountId]);

  const approveAllowance = useCallback(async (tokenId, spenderId, amount) => {
    const aid = AccountId.fromString(accountId);
    await hcRef.current.sendTransaction(aid, new AccountAllowanceApproveTransaction().approveTokenAllowance(TokenId.fromString(tokenId), aid, AccountId.fromString(spenderId), amount));
  }, [accountId]);

  const runSetup = useCallback(async () => {
    // 1. Associate
    const assocRes = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${config.nrxTokenId}`);
    const assocData = await assocRes.json();
    if (!assocData.tokens?.length) {
      await associateToken(config.nrxTokenId);
      await new Promise(r => setTimeout(r, 3000));
    }

    // 2. Faucet
    const balRes = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${config.nrxTokenId}`);
    const balData = await balRes.json();
    if (!balData.tokens?.length || parseInt(balData.tokens[0].balance) === 0) {
      await fetch("/api/faucet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
      await new Promise(r => setTimeout(r, 3000));
    }

    // 3. Approve
    const allowRes = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/allowances/tokens?spender.id=${config.fliparenaId}&token.id=${config.nrxTokenId}`);
    const allowData = await allowRes.json();
    if (!allowData.allowances?.length || parseInt(allowData.allowances[0].amount) === 0) {
      await approveAllowance(config.nrxTokenId, config.fliparenaId, 10_000_00);
      await new Promise(r => setTimeout(r, 3000));
    }

    setStatus("ready");
  }, [accountId, config, associateToken, approveAllowance]);

  const disconnect = useCallback(async () => {
    if (hcRef.current) await hcRef.current.disconnect();
    setAccountId(null); setEvmAddress(null); setStatus("disconnected");
  }, []);

  return (
    <Ctx.Provider value={{ accountId, evmAddress, status, connect, runSetup, disconnect }}>
      {children}
    </Ctx.Provider>
  );
}
