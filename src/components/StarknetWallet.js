import React, { useState } from 'react';
import './StarknetWallet.css';

const StarknetWallet = ({ starknet }) => {
  const [showNFTs, setShowNFTs] = useState(false);
  const [showWalletPopup, setShowWalletPopup] = useState(false);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleConnect = async () => {
    console.log('🔵 Connect button clicked');
    console.log('🔍 window.starknet available:', !!window.starknet);
    
    // Show popup for 3 seconds
    setShowWalletPopup(true);
    setTimeout(() => setShowWalletPopup(false), 3000);
    
    if (!starknet) {
      console.error('❌ starknet prop is missing');
      return;
    }
    
    try {
      const result = await starknet.connectWallet();
      console.log('✅ Connection result:', result);
    } catch (error) {
      console.error('❌ Connection error:', error);
    }
  };

  const handleDisconnect = () => {
    console.log('👋 Disconnect button clicked');
    if (starknet) {
      starknet.disconnectWallet();
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

  if (!starknet) {
    return null;
  }

  // Mock NFT data for display (will be replaced with real data)
  const mockNFTs = starknet.mintedNFT ? [
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
            <span className="wallet-popup-icon"></span>
            <p className="wallet-popup-text">
              <strong>Use Braavos Wallet</strong><br />
              For the best experience, please use Braavos wallet to connect.
            </p>
          </div>
        </div>
      )}

      {!starknet.isConnected ? (
        <button 
          className="wallet-connect-btn"
          onClick={handleConnect}
          disabled={starknet.isConnecting}
        >
          {starknet.isConnecting ? (
            <>
              <span className="spinner"></span>
              Connecting...
            </>
          ) : (
            <>
              <span className="wallet-icon"></span>
              Connect Wallet
            </>
          )}
        </button>
      ) : (
        <>
          <div className="wallet-connected">
            <div className="wallet-info">
              <div className="wallet-address">
                <span className="connected-dot"></span>
                {formatAddress(starknet.walletAddress)}
              </div>
              <button 
                className="wallet-nft-btn"
                onClick={toggleNFTs}
                title="View your NFTs"
              >
                NFTs
              </button>
            </div>
            <button 
              className="wallet-disconnect-btn"
              onClick={handleDisconnect}
              title="Disconnect wallet"
            >
              ✕
            </button>
          </div>

          {showNFTs && (
            <div className="nft-dropdown">
              <div className="nft-dropdown-header">
                <h3> Your Game NFTs</h3>
              </div>

              <div className="nft-grid">
                {mockNFTs.length === 0 ? (
                  <div className="no-nfts">
                    <div className="no-nfts-icon">🎮</div>
                    <p>No NFTs yet</p>
                    <p className="no-nfts-hint">Play a game and mint your first achievement!</p>
                  </div>
                ) : (
                  mockNFTs.map((nft, index) => (
                    <div key={index} className="nft-card">
                      <div className="nft-card-header">
                        <div className="nft-card-icon">🎯</div>
                        <div className="nft-card-badge">#{nft.tokenId}</div>
                      </div>
                      
                      <div className="nft-card-body">
                        <div className="nft-stat-row">
                          <div className="nft-stat">
                            <div className="nft-stat-label">Score</div>
                            <div className="nft-stat-value">{nft.score}</div>
                          </div>
                          <div className="nft-stat">
                            <div className="nft-stat-label">Max Combo</div>
                            <div className="nft-stat-value">×{nft.maxCombo}</div>
                          </div>
                        </div>
                        
                        <div className="nft-stat-row">
                          <div className="nft-stat">
                            <div className="nft-stat-label">Tokens</div>
                            <div className="nft-stat-value">{nft.tokensSliced}</div>
                          </div>
                          <div className="nft-stat">
                            <div className="nft-stat-label">Slashes</div>
                            <div className="nft-stat-value">{nft.totalSlashes}</div>
                          </div>
                        </div>
                      </div>

                      <div className="nft-card-footer">
                        <div className="nft-date">
                          {formatTimestamp(nft.timestamp)}
                        </div>
                        <a 
                          href={`https://sepolia.starkscan.co/contract/${process.env.REACT_APP_STARKNET_CONTRACT_ADDRESS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="nft-view-link"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {mockNFTs.length > 0 && (
                <div className="nft-dropdown-footer">
                  <a 
                    href={`https://sepolia.starkscan.co/contract/${process.env.REACT_APP_STARKNET_CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-all-link"
                  >
                    View All on Starkscan →
                  </a>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StarknetWallet;
