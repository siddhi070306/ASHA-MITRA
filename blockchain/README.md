# ASHA Saathi Blockchain Anchoring System

This folder contains the Solidity smart contract and deployment files to support the tamper-proof clinical records feature on the **Polygon Blockchain**.

## Key Architecture Overview
To protect patient privacy while ensuring clinical audit integrity, we:
1. **Hash Patient Records**: Calculate the SHA-256 hash of patient parameters (Age, Village, Severity) + original voice transcript locally in browser.
2. **Anchor On-Chain**: Send only the `SHA-256 hash`, `ASHA ID` (anonymized), and `Severity Level` (Red/Yellow/Green) to the smart contract.
3. **No Private Data On-Chain**: No patient names, phone numbers, or transcripts are written to the blockchain, making it HIPAA-compliant.

---

## 1. Local Compile & Deploy Instructions

### Prerequisites
Install Hardhat and dependencies inside this folder:
```bash
npm init -y
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
npx hardhat init
```

### Deploy to Polygon Amoy Testnet
Add the network to your `hardhat.config.js`:
```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    polygon_amoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY] // Replace with your wallet private key
    }
  }
};
```
Deploy the contract:
```bash
npx hardhat run deploy.js --network polygon_amoy
```

---

## 2. Frontend client connection snippet
In the React frontend, you can import `ethers` and call the anchored smart contract using the following client file format:

```javascript
import { ethers } from 'ethers';

const CONTRACT_ABI = [
  "function anchorTriage(bytes32 txHash, bytes32 dataHash, string workerId, string urgency) external",
  "function getAnchor(bytes32 txHash) external view returns (bytes32, uint256, string, string)"
];

const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";

export async function anchorTriageOnChain(txHash, dataHash, workerId, urgency) {
  if (!window.ethereum) throw new Error("No crypto wallet found");
  
  // Connect to user's wallet (e.g. MetaMask / Web3Auth)
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  
  // Submit block transaction
  const tx = await contract.anchorTriage(
    ethers.utils.formatBytes32String(txHash),
    ethers.utils.formatBytes32String(dataHash),
    workerId,
    urgency
  );
  
  // Wait for 1 confirmation
  const receipt = await tx.wait(1);
  return {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber
  };
}
```
