import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import multiplayerService from '../services/multiplayerService';
import './MultiplayerLobby.css';

// Use environment variable or fallback to localhost
const SOCKET_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const socket = io(SOCKET_URL, {
  autoConnect: false
});

const MultiplayerLobby = ({ walletAddress, onStartGame, onBack }) => {
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'join', 'stats'
  const [selectedTier, setSelectedTier] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [playerStats, setPlayerStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (walletAddress) {
      fetchPlayerStats();
    }
    if (activeTab === 'join') {
      fetchAvailableGames();
      
      // Auto-refresh every 3 seconds when on join tab
      const interval = setInterval(() => {
        fetchAvailableGames();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [walletAddress, activeTab]);

  // Force initial fetch on component mount
  useEffect(() => {
    fetchAvailableGames();
  }, []);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'aptos_multiplayer_games') {
        fetchAvailableGames();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      console.log('🔌 Connected to backend');
    });

    socket.on('game_created', (game) => {
      console.log('🎮 New game created:', game);
      fetchAvailableGames();
    });

    socket.on('game_joined', (game) => {
      console.log('🎮 Game joined:', game);
      
      // Check if this is YOUR game that was joined (you are player1)
      if (walletAddress && multiplayerService.compareAddresses(game.player1, walletAddress)) {
        showNotification('Opponent joined! Starting match...', 'success');
        setTimeout(() => {
          onStartGame(game.game_id);
        }, 2000);
      } else {
        fetchAvailableGames();
      }
    });

    socket.on('games_updated', (games) => {
      console.log('🔄 Games list updated:', games);
      setAvailableGames(games);
    });

    socket.on('game_finished', (data) => {
      console.log('✅ Game finished:', data);
      fetchAvailableGames();
    });

    return () => {
      socket.off('connect');
      socket.off('game_created');
      socket.off('game_joined');
      socket.off('games_updated');
      socket.off('game_finished');
      socket.disconnect();
    };
  }, [walletAddress, onStartGame]);

  const fetchPlayerStats = async () => {
    const stats = await multiplayerService.getPlayerStats(walletAddress);
    setPlayerStats(stats);
  };

  const fetchAvailableGames = async () => {
    const games = await multiplayerService.getAvailableGames();
    setAvailableGames(games);
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateGame = async () => {
    if (!selectedTier) {
      showNotification('Please select a bet tier', 'error');
      return;
    }

    setLoading(true);
    const result = await multiplayerService.createGame(selectedTier.id);
    
    if (result.success) {
      showNotification(`Game created! Waiting for opponent...`, 'success');
      await fetchPlayerStats();
      setTimeout(async () => {
        await fetchAvailableGames();
        setActiveTab('join');
      }, 1000);
    } else {
      showNotification(`Failed to create game: ${result.error}`, 'error');
    }
    setLoading(false);
  };

  const handleJoinGame = async (gameId) => {
    setLoading(true);
    const result = await multiplayerService.joinGame(gameId);
    
    if (result.success) {
      showNotification('Joined game! Starting match...', 'success');
      setTimeout(() => {
        onStartGame(gameId);
      }, 2000);
    } else {
      showNotification(`Failed to join game: ${result.error}`, 'error');
    }
    setLoading(false);
  };

  const betTiers = multiplayerService.getBetTiers();

  return (
    <div className="multiplayer-lobby">
      {notification && (
        <div className={`lobby-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="lobby-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h1>⚔️ MULTIPLAYER ARENA</h1>
        <div className="wallet-info">
          {multiplayerService.formatAddress(walletAddress)}
        </div>
      </div>

      <div className="lobby-tabs">
        <button 
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Game
        </button>
        <button 
          className={`tab ${activeTab === 'join' ? 'active' : ''}`}
          onClick={() => setActiveTab('join')}
        >
          Join Game
        </button>
        <button 
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          My Stats
        </button>
      </div>

      <div className="lobby-content">
        {activeTab === 'create' && (
          <div className="create-game-section">
            <h2>Choose Your Stake</h2>
            <p className="section-description">Winner takes all! Select your bet tier to create a new game.</p>
            
            <div className="bet-tiers">
              {betTiers.map(tier => (
                <div 
                  key={tier.id}
                  className={`bet-tier-card ${selectedTier?.id === tier.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTier(tier)}
                >
                  <div className="tier-label">{tier.label}</div>
                  <div className="tier-amount">{tier.amount} APT</div>
                  <div className="tier-prize">Win: {tier.amount * 2} APT</div>
                  <div className="tier-description">{tier.description}</div>
                </div>
              ))}
            </div>

            <button 
              className="create-game-btn"
              onClick={handleCreateGame}
              disabled={!selectedTier || loading}
            >
              {loading ? 'Creating Game...' : `Create Game - Stake ${selectedTier?.amount || '?'} APT`}
            </button>
          </div>
        )}

        {activeTab === 'join' && (
          <div className="join-game-section">
            <h2>Available Games</h2>
            <p className="section-description">Join an open game and compete for the prize pool!</p>
            
            <button 
              className="refresh-btn"
              onClick={() => {
                fetchAvailableGames();
              }}
              disabled={loading}
            >
              🔄 Refresh
            </button>

            <div className="debug-info" style={{ 
              padding: '10px', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '8px', 
              marginBottom: '20px',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              <div>Available Games Count: {availableGames.length}</div>
              <div>Wallet: {walletAddress || 'Not connected'}</div>
              <div>Loading: {loading ? 'Yes' : 'No'}</div>
            </div>

            <div className="available-games">
              {availableGames.length === 0 ? (
                <div className="no-games">
                  <div className="no-games-icon">🎮</div>
                  <p>No games available</p>
                  <p className="no-games-hint">Create your own game to get started!</p>
                </div>
              ) : (
                availableGames.map((game, index) => {
                  const betAmountOctas = parseInt(game.bet_amount);
                  const tier = betTiers.find(t => t.octas === betAmountOctas);
                  
                  const isOwnGame = multiplayerService.compareAddresses(game.player1, walletAddress);
                  const isDisabled = loading || isOwnGame;
                  
                  return (
                    <div key={index} className="game-card">
                      <div className="game-info">
                        <div className="game-tier">{tier?.label || 'Unknown'}</div>
                        <div className="game-stake">Stake: {tier?.amount || (betAmountOctas / 100000000)} APT</div>
                        <div className="game-prize">Prize: {(tier?.amount || (betAmountOctas / 100000000)) * 2} APT</div>
                        <div className="game-creator">
                          Host: {multiplayerService.formatAddress(game.player1)}
                        </div>
                        <div className="game-id">Game ID: {game.game_id}</div>
                      </div>
                      <button 
                        className="join-btn"
                        onClick={() => {
                          handleJoinGame(game.game_id);
                        }}
                        disabled={isDisabled}
                      >
                        {isOwnGame ? 'Your Game' : 'Join Game'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <h2>Your Statistics</h2>
            
            {playerStats ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🎮</div>
                  <div className="stat-value">{playerStats.gamesPlayed}</div>
                  <div className="stat-label">Games Played</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-value">{playerStats.gamesWon}</div>
                  <div className="stat-label">Games Won</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-value">{playerStats?.winRate || 0}%</div>
                  <div className="stat-label">Win Rate</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-value">{playerStats?.totalWagered?.toFixed(2) || '0.00'}</div>
                  <div className="stat-label">Total Wagered (APT)</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">💎</div>
                  <div className="stat-value">{playerStats?.totalWinnings?.toFixed(2) || '0.00'}</div>
                  <div className="stat-label">Total Winnings (APT)</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📈</div>
                  <div className="stat-value">
                    {(playerStats.totalWinnings - playerStats.totalWagered).toFixed(2)}
                  </div>
                  <div className="stat-label">Net Profit (APT)</div>
                </div>
              </div>
            ) : (
              <div className="loading-stats">Loading stats...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerLobby;
