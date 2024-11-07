import React, { createContext, useContext, useState } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  xBullModule,
  FreighterModule,
  AlbedoModule,
  XBULL_ID,
} from "@creit.tech/stellar-wallets-kit";
import * as StellarSdk from "@stellar/stellar-sdk";

// Create a context for the wallet management
const WalletContext = createContext(null);

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }) => {
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectedWalletId, setConnectedWalletId] = useState(null);

  const kit = new StellarWalletsKit({
    selectedWalletId: connectedWalletId || XBULL_ID,
    network: WalletNetwork.TESTNET,
    modules: [new xBullModule(), new FreighterModule(), new AlbedoModule()],
  });

  const handleConnect = async () => {
    try {
      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          setConnectedWalletId(option.id);
          const publicKey = await kit.getPublicKey();
          setPublicKey(publicKey);
          setConnected(true);
        },
      });
    } catch (error) {
      console.error('Error connecting:', error);
    }
     
  };

  const handleDisconnect = () => {
    setPublicKey(null);
    setConnectedWalletId(null);
    setBalance('0');
    setConnected(false); // Update connected state
  };

  const handleWithdraw = async (amtw) => {
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const server = new StellarSdk.Horizon.Server(
        "https://horizon-testnet.stellar.org",
      );

      const account = await server.loadAccount(publicKey);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
       .addOperation(
          StellarSdk.Operation.payment({
            destination: "GBSRGYQ36ZTF3YDH7CCGA4OJSJAGCEKHSITJCQFWDVLS6Q6RFF6AGIEH",
            asset: StellarSdk.Asset.native(),
            amount: amtw,
          }),
        )
       .addMemo(StellarSdk.Memo.text("Withdrawal"))
       .setTimeout(60)
       .build();

      const { result: signedTxnXdr } = await kit.signTx({
        xdr: transaction.toXDR(),
        publicKeys: [publicKey],
        network: WalletNetwork.TESTNET,
      });

      const signedTxn = new StellarSdk.Transaction(
        signedTxnXdr,
        StellarSdk.Networks.TESTNET,
      );

      const txnResult = await server.submitTransaction(signedTxn, {
        skipMemoRequiredCheck: true,
      });

      if (txnResult.successful) {
        alert('Stake Submitted Succeddfully');
        await fetchBalance();
      } else {
        alert('Staking Failed');
      }
    } catch (error) {
      console.error(`Error withdrawing funds - ${error?.message}`);
      alert('Staking failed');
    }
  };

  const handlePayment = async (amt) => {
    if (!publicKey) {
      console.error("No public key found. Please connect your wallet first.");
      return;
    }

    try {
      const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      const sourceKeys = StellarSdk.Keypair.fromSecret("SCK2VRDP2LCHPA2DINM5U5VEPJNU7IT7MIBPNWHVNUX24XOZCNLLFANI");
      const destinationId = publicKey; // Use the connected wallet's public key

      await server.loadAccount(destinationId);
      const sourceAccount = await server.loadAccount(sourceKeys.publicKey());

      let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationId,
            asset: StellarSdk.Asset.native(),
            amount: amt,
          })
        )
        .addMemo(StellarSdk.Memo.text("Test Transaction"))
        .setTimeout(180)
        .build();

      transaction.sign(sourceKeys);
      const result = await server.submitTransaction(transaction);
      console.log("Payment success! Results:", result);
    } catch (error) {
      console.error("Payment failed!", error);
    }
  };

  const fetchBalance = async () => {
    if (!publicKey) return;
    try {
      const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      const account = await server.loadAccount(publicKey);
      const balance = account.balances.find(b => b.asset_type === 'native');
      setBalance(balance?.balance || '0');
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        handleConnect,
        handleDisconnect,
        handleWithdraw,
        handlePayment,
        publicKey,
        balance,
        fetchBalance,
        connected,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

