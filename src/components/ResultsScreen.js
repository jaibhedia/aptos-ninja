import React, { useState, useEffect } from 'react';
import multiplayerService from '../services/multiplayerService';

const ResultsScreen = ({ gameState, onStartGame, onShowStartScreen, aptos, multiplayerGameId, onBackToMultiplayer }) => {
  const isNewBest = gameState.score > gameState.bestScore;
  const [mintingStatus, setMintingStatus] = useState(null); // null, 'minting', 'success', 'error'
  const [transactionHash, setTransactionHash] = useState(null);
  const [multiplayerSubmitted, setMultiplayerSubmitted] = useState(false);

  // Submit multiplayer score when game ends
  useEffect(() => {
    const submitMultiplayerScore = async () => {
      if (multiplayerGameId && aptos.isConnected && !multiplayerSubmitted) {
        setMultiplayerSubmitted(true);
        console.log('🎮 Submitting multiplayer score:', gameState.score);
        
        const result = await multiplayerService.submitScore(multiplayerGameId, gameState.score);
        
        if (result.success) {
          console.log('✅ Multiplayer score submitted successfully');
        } else {
          console.error('❌ Failed to submit multiplayer score:', result.error);
        }
      }
    };

    submitMultiplayerScore();
  }, [multiplayerGameId, gameState.score, aptos.isConnected, multiplayerSubmitted]);

  return (
    <div className="screen results-screen">
      <div className="results-container">
        {/* Simple Game Over Title */}
        <div className="game-over-title">
          <h1>Game Over</h1>
          {isNewBest && <div className="new-best-badge">New Best!</div>}
        </div>
        
        {/* Score Section */}
        <div className="score-section">
          <div className="final-score">
            <span className="score-label">Score</span>
            <span className="score-value">{gameState.score}</span>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{gameState.citreaSlashed || 0}</span>
            <span className="stat-label">Tokens Slashed</span>
          </div>
          <div className="stat">
            <span className="stat-value">{gameState.maxCombo || 0}</span>
            <span className="stat-label">Max Combo</span>
          </div>
          <div className="stat">
            <span className="stat-value">{gameState.bestScore || 0}</span>
            <span className="stat-label">Best Score</span>
          </div>
        </div>
        
        {/* NFT Minting Section */}
        {aptos && aptos.isConnected && (
          <div className="nft-minting-section">
            {mintingStatus === 'success' ? (
              <div className="mint-success">
                <div className="success-header">
                  <div className="success-icon">🎉</div>
                  <h3 className="success-title">NFT Minted Successfully!</h3>
                  <p className="success-subtitle">Your achievement is now on Aptos blockchain</p>
                </div>
                
                <div className="nft-links">
                  {transactionHash && (
                    <a 
                      href={`https://explorer.aptoslabs.com/txn/${transactionHash}?network=testnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nft-link transaction-link"
                    >
                      
                      <span className="link-text">View Transaction</span>
                      <span className="link-arrow">→</span>
                    </a>
                  )}
                  
                  <a 
                    href={`https://explorer.aptoslabs.com/account/${aptos.walletAddress}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nft-link contract-link"
                  >
                    
                    <span className="link-text">View Your Account</span>
                    <span className="link-arrow">→</span>
                  </a>
                </div>

                <div className="nft-details">
                  <div className="nft-detail-row">
                    <span className="detail-label">Your Wallet:</span>
                    <code className="detail-value">{aptos.walletAddress}</code>
                  </div>
                  
                  {transactionHash && (
                    <div className="nft-detail-row">
                      <span className="detail-label">Transaction:</span>
                      <code className="detail-value">{transactionHash}</code>
                    </div>
                  )}
                </div>

                <div className="nft-note">
                  <span className="note-icon">ℹ️</span>
                  <span className="note-text">
                    Your NFT is confirmed on-chain. View it in your Petra wallet!
                  </span>
                </div>
              </div>
            ) : (
              <button
                className="game-button mint-nft"
                onClick={async () => {
                  setMintingStatus('minting');
                  try {
                    const duration = gameState.gameEndTime ? 
                      Math.floor((gameState.gameEndTime - gameState.gameStartTime) / 1000) : 0;
                    
                    const result = await aptos.mintGameNFT({
                      score: gameState.score,
                      maxCombo: gameState.maxCombo || 0,
                      tokensSliced: gameState.citreaSlashed || 0,
                      bombsHit: gameState.bombsHit || 0,
                      duration: duration
                    });
                    
                    if (result.success && result.transactionHash) {
                      setTransactionHash(result.transactionHash);
                    }
                    
                    setMintingStatus('success');
                  } catch (error) {
                    console.error('Failed to mint NFT:', error);
                    setMintingStatus('error');
                    setTimeout(() => setMintingStatus(null), 3000);
                  }
                }}
                disabled={mintingStatus === 'minting'}
              >
                {mintingStatus === 'minting' ? (
                  <>
                    <span className="spinner"></span>
                    Minting NFT...
                  </>
                ) : mintingStatus === 'error' ? (
                  '❌ Mint Failed - Try Again'
                ) : (
                  '🎮 Mint Game NFT'
                )}
              </button>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="button-row">
          {multiplayerGameId ? (
            <>
              <button 
                className="game-button back-multiplayer" 
                onClick={onBackToMultiplayer}
              >
                ⚔️ Back to Arena
              </button>
              <button 
                className="game-button back-home" 
                onClick={onShowStartScreen}
              >
                🏠 Home
              </button>
            </>
          ) : (
            <>
              <button 
                className="game-button play-again" 
                onClick={onStartGame}
              >
                🔄 Replay
              </button>
              <button 
                className="game-button back-home" 
                onClick={onShowStartScreen}
              >
                Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsScreen;