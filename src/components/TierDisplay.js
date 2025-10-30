import React, { useState, useEffect } from 'react';
import { 
  getTierByScore, 
  getProgressToNextTier, 
  canMintNFTAtTier,
  calculatePlayerStats 
} from '../utils/tierSystem';
import './TierDisplay.css';

const TierDisplay = ({ totalScore, gamesPlayed, bestScore, compact = false }) => {
  const [stats, setStats] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const playerStats = calculatePlayerStats(totalScore, gamesPlayed, bestScore);
    setStats(playerStats);
  }, [totalScore, gamesPlayed, bestScore]);

  if (!stats) return null;

  const { currentTier, nextTier, progress, scoreNeeded, nftInfo } = stats;

  if (compact) {
    return (
      <div className="tier-display-compact">
        <div className="tier-icon" style={{ color: currentTier.color }}>
          {currentTier.icon}
        </div>
        <div className="tier-info">
          <div className="tier-name" style={{ color: currentTier.color }}>
            {currentTier.name}
          </div>
          <div className="tier-title">{currentTier.rewards.title}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tier-display-full">
      <div className="tier-header">
        <div className="tier-current">
          <div 
            className="tier-icon-large" 
            style={{ 
              background: currentTier.gradient,
              boxShadow: `0 0 30px ${currentTier.color}66`
            }}
          >
            {currentTier.icon}
          </div>
          <div className="tier-details">
            <h2 style={{ color: currentTier.color }}>{currentTier.name}</h2>
            <p className="tier-title-text">{currentTier.rewards.title} {currentTier.rewards.badge}</p>
            <div className="tier-stats">
              <span>Total Score: {totalScore.toLocaleString()}</span>
              <span>•</span>
              <span>Games: {gamesPlayed}</span>
              <span>•</span>
              <span>Best: {bestScore}</span>
            </div>
          </div>
        </div>

        {nftInfo.canMint && (
          <div className="nft-available-badge">
            <span className="nft-pulse">🎁</span>
            <span>NFT Ready!</span>
          </div>
        )}
      </div>

      {nextTier && (
        <div className="tier-progress-section">
          <div className="progress-header">
            <span>Progress to {nextTier.name}</span>
            <span className="score-needed">{scoreNeeded.toLocaleString()} points needed</span>
          </div>
          
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill"
              style={{ 
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier.color})`
              }}
            >
              <span className="progress-percentage">{Math.floor(progress)}%</span>
            </div>
          </div>

          <div className="next-tier-preview">
            <span className="next-tier-icon">{nextTier.icon}</span>
            <span>{nextTier.name}</span>
            {nextTier.canMintNFT && <span className="nft-badge">🎁 NFT Unlock</span>}
          </div>
        </div>
      )}

      {nextTier === null && (
        <div className="max-tier-message">
          <span className="crown-icon">👑</span>
          <h3>Maximum Rank Achieved!</h3>
          <p>You are among the elite. Keep slicing to maintain your legend!</p>
        </div>
      )}

      <button 
        className="details-toggle"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? 'Hide' : 'Show'} Achievements & NFTs
      </button>

      {showDetails && (
        <div className="tier-details-expanded">
          {/* NFT Milestones */}
          <div className="nft-section">
            <h3>🎁 NFT Milestones</h3>
            <div className="nft-grid">
              {stats.unlockedNFTs.map(tier => (
                <div key={tier.id} className="nft-card unlocked">
                  <div className="nft-icon">{tier.icon}</div>
                  <div className="nft-name">{tier.nftReward}</div>
                  <div className="nft-status">✅ Unlocked</div>
                </div>
              ))}
              {stats.totalNFTsAvailable > stats.unlockedNFTs.length && (
                <div className="nft-card locked">
                  <div className="nft-icon">🔒</div>
                  <div className="nft-name">Keep Playing!</div>
                  <div className="nft-status">
                    {stats.unlockedNFTs.length}/{stats.totalNFTsAvailable} Unlocked
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Achievements */}
          <div className="achievements-section">
            <h3>🏆 Achievements ({stats.achievements.length})</h3>
            <div className="achievements-grid">
              {stats.achievements.map((achievement, idx) => (
                <div key={idx} className="achievement-card">
                  <span className="achievement-icon">{achievement.icon}</span>
                  <div className="achievement-info">
                    <div className="achievement-name">{achievement.name}</div>
                    <div className="achievement-desc">{achievement.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TierDisplay;
