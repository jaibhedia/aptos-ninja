import React, { useState } from 'react';
import './StarknetWallet.css';

const AptosWallet = ({ aptos }) => {
  const [showNFTs, setShowNFTs] = useState(false);
  const [showWalletPopup, setShowWalletPopup] = useState(false);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleConnect = async () => {
    console.log('🔵 Connect button clicked');
    console.log('🔍 window.aptos available:', !!window.aptos);
    
    // Show popup for 3 seconds
    setShowWalletPopup(true);
    setTimeout(() => setShowWalletPopup(false), 3000);
    
    if (!aptos) {
      console.error('❌ aptos prop is missing');
      return;
    }
    
    try {
      const result = await aptos.connectWallet();
      console.log('✅ Connection result:', result);
    } catch (error) {
      console.error('❌ Connection error:', error);
    }
  };

  const handleDisconnect = () => {
    console.log('👋 Disconnect button clicked');
    if (aptos) {
      aptos.disconnectWallet();
      setShowNFTs(false);
    }
  };

  const toggleNFTs = () => {
    setShowNFTs(!showNFTs);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!aptos) {
    return null;
  }

  // Mock NFT data for display (will be replaced with real data)
  const mockNFTs = aptos.mintedNFT ? [
    {
      tokenId: '1',
      score: 580,
      maxCombo: 12,
      tokensSliced: 58,
      totalSlashes: 120,
      timestamp: Date.now() / 1000
    }
  ] : [];

  return (
    <div className="starknet-wallet">
      {/* Wallet Popup */}
      {showWalletPopup && (
        <div className="wallet-popup">
          <div className="wallet-popup-content">
            <p className="wallet-popup-text">
              <strong>Use Petra Wallet</strong><br />
              For the best experience, please use Petra wallet to connect.
            </p>
          </div>
        </div>
      )}

      {!aptos.isConnected ? (
        <button 
          className="wallet-connect-btn"
          onClick={handleConnect}
          disabled={aptos.isConnecting}
        >
          {aptos.isConnecting ? (
            <>
              <span className="spinner"></span>
              Connecting...
            </>
          ) : (
            'Connect Wallet'
          )}
        </button>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-info">
            <div className="wallet-address-display">
              <span className="address-text">{formatAddress(aptos.walletAddress)}</span>
            </div>
            
            <div className="wallet-actions">
              <button 
                className="nft-toggle-btn"
                onClick={toggleNFTs}
                title="View your NFTs"
              >
                <span className="nft-icon">🎮</span>
                <span className="nft-count">{mockNFTs.length}</span>
              </button>
              
              <button 
                className="disconnect-btn"
                onClick={handleDisconnect}
                title="Disconnect wallet"
              >
                ✕
              </button>
            </div>
          </div>

          {/* NFT Gallery Dropdown */}
          {showNFTs && (
            <div className="nft-gallery-dropdown">
              <div className="nft-gallery-header">
                <h3>🎮 Your Game NFTs</h3>
                <button 
                  className="close-gallery-btn"
                  onClick={toggleNFTs}
                >
                  ✕
                </button>
              </div>
              
              <div className="nft-gallery-content">
                {mockNFTs.length === 0 ? (
                  <div className="no-nfts">
                    <span className="no-nfts-icon">🎯</span>
                    <p>No NFTs yet</p>
                    <p className="no-nfts-hint">Play a game and mint your first NFT!</p>
                  </div>
                ) : (
                  <div className="nft-grid">
                    {mockNFTs.map((nft) => (
                      <div key={nft.tokenId} className="nft-card">
                        <div className="nft-card-header">
                          <span className="nft-token-id">#{nft.tokenId}</span>
                          <span className="nft-timestamp">{formatTimestamp(nft.timestamp)}</span>
                        </div>
                        
                        <div className="nft-stats-grid">
                          <div className="nft-stat">
                            <span className="stat-label">Score</span>
                            <span className="stat-value highlight">{nft.score}</span>
                          </div>
                          <div className="nft-stat">
                            <span className="stat-label">Max Combo</span>
                            <span className="stat-value">{nft.maxCombo}x</span>
                          </div>
                          <div className="nft-stat">
                            <span className="stat-label">Tokens</span>
                            <span className="stat-value">{nft.tokensSliced}</span>
                          </div>
                          <div className="nft-stat">
                            <span className="stat-label">Slashes</span>
                            <span className="stat-value">{nft.totalSlashes}</span>
                          </div>
                        </div>
                        
                        <div className="nft-card-footer">
                          <button className="view-nft-btn">
                            View on Explorer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {aptos.error && (
        <div className="wallet-error">
          {aptos.error}
        </div>
      )}
    </div>
  );
};

export default AptosWallet;
