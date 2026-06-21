/**
 * ASHA Saathi - Blockchain Anchoring Frontend Client Integration
 * 
 * This file serves as the Web3 connector template using Ethers.js.
 * To use a live deployment, run:
 *   npm install ethers@5.7.2
 * and import this file to trigger actual Polygon transaction signings.
 */
import { ethers } from 'ethers';

// TriageAnchor ABI contract definition
const CONTRACT_ABI = [
  "function anchorTriage(bytes32 txHash, bytes32 dataHash, string workerId, string urgency) external",
  "function getAnchor(bytes32 txHash) external view returns (bytes32, uint256, string, string)"
];

// Replaced with your deployed contract address
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Anchors a SHA-256 triage hash to the live Polygon smart contract.
 * @param {string} txHash Unique local transaction identifier hash.
 * @param {string} dataHash Cryptographic hash of triage record values.
 * @param {string} workerId Anonymized worker ID.
 * @param {string} urgency Urgency alert classification.
 */
export async function anchorTriageOnChain(txHash, dataHash, workerId, urgency) {
  if (!window.ethereum) {
    throw new Error("No browser wallet provider detected (e.g. MetaMask / Web3Auth)");
  }
  
  // Request account access if needed
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  
  // Call smart contract anchor function
  const tx = await contract.anchorTriage(
    ethers.utils.formatBytes32String(txHash.substring(0, 31)), // formatting bytes32 fit
    ethers.utils.formatBytes32String(dataHash.substring(0, 31)),
    workerId,
    urgency
  );
  
  // Wait for block mining confirmation
  const receipt = await tx.wait(1);
  
  return {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber
  };
}
