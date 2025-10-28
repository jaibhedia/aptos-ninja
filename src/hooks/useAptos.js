import { useState, useEffect, useCallback } from 'react';
import aptosGameService from '../services/aptosService';

export const useAptos = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedNFT, setMintedNFT] = useState(null);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (window.aptos) {
          const account = await window.aptos.account();
          if (account && account.address) {
            aptosGameService.walletAddress = account.address;
            aptosGameService.walletConnected = true;
            setWalletAddress(account.address);
          }
        }
      } catch (err) {
        // Wallet not connected, ignore
        console.log('Wallet not auto-connected');
      }
    };
    
    checkConnection();
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await aptosGameService.connectWallet();
      
      if (result.success) {
        setWalletAddress(result.address);
        return result;
      } else {
        setError(result.error);
        return result;
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to connect wallet';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    aptosGameService.disconnectWallet();
    setWalletAddress(null);
    setError(null);
    setMintedNFT(null);
  }, []);

  // Start game session
  const startGameSession = useCallback(() => {
    aptosGameService.startGameSession();
  }, []);

  // Record a slash
  const recordSlash = useCallback((slashData) => {
    aptosGameService.recordSlash(slashData);
  }, []);

  // Mint NFT with game results
  const mintGameNFT = useCallback(async (gameStats) => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsMinting(true);
    setError(null);

    try {
      const result = await aptosGameService.mintGameNFT(gameStats);
      
      if (result.success) {
        setMintedNFT(result);
      } else {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Failed to mint NFT';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsMinting(false);
    }
  }, [walletAddress]);

  // Get game session data
  const getGameSession = useCallback(async (tokenId) => {
    try {
      return await aptosGameService.getGameSession(tokenId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Get user's NFT count
  const getUserNFTCount = useCallback(async (address) => {
    try {
      return await aptosGameService.getUserNFTCount(address);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Get user's NFTs
  const getUserNFTs = useCallback(async (address) => {
    try {
      return await aptosGameService.getUserNFTs(address);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    walletAddress,
    isConnected: !!walletAddress,
    isConnecting,
    error,
    isMinting,
    mintedNFT,
    connectWallet,
    disconnectWallet,
    startGameSession,
    recordSlash,
    mintGameNFT,
    getGameSession,
    getUserNFTCount,
    getUserNFTs
  };
};
