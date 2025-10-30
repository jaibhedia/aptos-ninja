import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Use environment variable or fallback to localhost
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

class MultiplayerGameService {
  constructor() {
    const config = new AptosConfig({ network: Network.TESTNET });
    this.aptos = new Aptos(config);
    
    this.MODULE_ADDRESS = "0xe48c34be75bfd112018e4f35154d4d2756962b20d26f73806833167077c69267";
    this.MODULE_NAME = "multiplayer_game";
    
    this.BET_TIERS = [
      { 
        id: 1, 
        amount: 0.1, 
        label: "Casual", 
        octas: 10000000, 
        description: "Perfect for beginners",
        token: "APT",
        tokenName: "Aptos",
        color: "#2ED8A7",
        borderColor: "#2ED8A7",
        glowColor: "rgba(46, 216, 167, 0.3)"
      },
      { 
        id: 2, 
        amount: 0.5, 
        label: "Standard", 
        octas: 50000000, 
        description: "Most popular choice",
        token: "APT",
        tokenName: "Aptos",
        color: "#2ED8A7",
        borderColor: "#FFD700",
        glowColor: "rgba(255, 215, 0, 0.3)"
      },
      { 
        id: 3, 
        amount: 1, 
        label: "Competitive", 
        octas: 100000000, 
        description: "For serious players",
        token: "APT",
        tokenName: "Aptos",
        color: "#2ED8A7",
        borderColor: "#FF6B6B",
        glowColor: "rgba(255, 107, 107, 0.3)"
      },
      { 
        id: 4, 
        amount: 5, 
        label: "High Stakes", 
        octas: 500000000, 
        description: "Big risk, big reward",
        token: "APT",
        tokenName: "Aptos",
        color: "#2ED8A7",
        borderColor: "#9D4EDD",
        glowColor: "rgba(157, 78, 221, 0.3)"
      },
    ];
  }

  async createGame(betTier) {
    try {
      if (!window.aptos) throw new Error('Wallet not connected');

      // Get wallet address
      const account = await window.aptos.account();
      const walletAddress = account.address;

      const payload = {
        type: "entry_function_payload",
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::create_game`,
        type_arguments: [],
        arguments: [this.MODULE_ADDRESS, betTier.toString()]
      };

      const response = await window.aptos.signAndSubmitTransaction({ payload });
      await this.aptos.waitForTransaction({ transactionHash: response.hash });
      
      // Get the game ID from events or use timestamp as fallback
      const tx = await this.aptos.getTransactionByHash({ transactionHash: response.hash });
      let gameId = Date.now();
      
      if (tx.events) {
        const createEvent = tx.events.find(e => e.type.includes('GameCreatedEvent'));
        if (createEvent && createEvent.data && createEvent.data.game_id) {
          gameId = createEvent.data.game_id;
        }
      }
      
      // Get tier info
      const tierInfo = this.BET_TIERS.find(t => t.id === betTier);
      
      // Report to backend
      try {
        await fetch(`${API_BASE_URL}/api/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: gameId,
            bet_amount: tierInfo.octas,
            player1: walletAddress,
            transactionHash: response.hash
          })
        });
      } catch (backendError) {
        console.warn('Backend unavailable, using localStorage fallback');
        // Fallback: Save to localStorage
        this.saveLocalGame({
          game_id: gameId,
          bet_amount: tierInfo.octas,
          player1: walletAddress,
          player2: '0x0',
          state: 0,
          created_at: Date.now()
        });
      }
      
      return { success: true, transactionHash: response.hash, gameId };
    } catch (error) {
      console.error('Failed to create game:', error);
      return { success: false, error: error.message };
    }
  }

  async joinGame(gameId) {
    try {
      if (!window.aptos) throw new Error('Wallet not connected');

      // Get wallet address
      const account = await window.aptos.account();
      const walletAddress = account.address;

      const payload = {
        type: "entry_function_payload",
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::join_game`,
        type_arguments: [],
        arguments: [this.MODULE_ADDRESS, gameId.toString()]
      };
      
      const response = await window.aptos.signAndSubmitTransaction({ payload });
      await this.aptos.waitForTransaction({ transactionHash: response.hash });
      
      // Report to backend
      try {
        await fetch(`${API_BASE_URL}/api/games/${gameId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player2: walletAddress,
            transactionHash: response.hash
          })
        });
      } catch (backendError) {
        console.warn('Backend unavailable, using localStorage fallback');
        // Fallback: Mark game as joined in localStorage
        this.markGameJoined(gameId);
      }
      
      return { success: true, transactionHash: response.hash };
    } catch (error) {
      console.error('Failed to join game:', error);
      return { success: false, error: error.message };
    }
  }

  async submitScore(gameId, finalScore) {
    try {
      if (!window.aptos) throw new Error('Wallet not connected');

      const payload = {
        type: "entry_function_payload",
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::submit_score`,
        type_arguments: [],
        arguments: [this.MODULE_ADDRESS, gameId.toString(), finalScore.toString()]
      };

      const response = await window.aptos.signAndSubmitTransaction({ payload });
      await this.aptos.waitForTransaction({ transactionHash: response.hash });
      
      // Report game completion to backend (so it gets removed from cache)
      try {
        await fetch(`${API_BASE_URL}/api/games/${gameId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionHash: response.hash
          })
        });
      } catch (backendError) {
        console.warn('Backend unavailable for game finish notification');
      }
      
      return { success: true, transactionHash: response.hash };
    } catch (error) {
      console.error('Failed to submit score:', error);
      return { success: false, error: error.message };
    }
  }

  async getAvailableGames() {
    try {
      // ONLY use backend API - no blockchain queries to avoid rate limits
      const backendUrl = `${API_BASE_URL}/api/games/available`;
      
      const response = await fetch(backendUrl);
      if (response.ok) {
        const backendGames = await response.json();
        return backendGames.map(g => ({
          game_id: g.game_id,
          bet_amount: g.bet_amount,
          player1: g.player1,
          player2: g.player2 || '0x0',
          state: g.state || 0,
          created_at: g.created_at
        }));
      }
      
      // If backend fails, return empty array
      console.warn('Backend not available');
      return [];
    } catch (error) {
      console.error('Failed to fetch available games:', error);
      return [];
    }
  }

  getLocalGames() {
    try {
      const stored = localStorage.getItem('aptos_multiplayer_games');
      if (!stored) return [];
      const games = JSON.parse(stored);
      // Filter out games older than 1 hour
      const oneHourAgo = Date.now() - 3600000;
      return games.filter(g => g.created_at > oneHourAgo && g.state === 0);
    } catch (error) {
      return [];
    }
  }

  saveLocalGame(gameData) {
    try {
      const games = this.getLocalGames();
      games.push(gameData);
      localStorage.setItem('aptos_multiplayer_games', JSON.stringify(games));
    } catch (error) {
      console.error('Failed to save game locally:', error);
    }
  }

  markGameJoined(gameId) {
    try {
      const games = this.getLocalGames();
      const updated = games.map(g => 
        g.game_id === gameId ? { ...g, state: 1 } : g
      );
      localStorage.setItem('aptos_multiplayer_games', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update game:', error);
    }
  }

  async getGameCreatedEvents() {
    try {
      const response = await this.aptos.getAccountTransactions({
        accountAddress: this.MODULE_ADDRESS,
      });
      
      const createdGames = [];
      response.forEach(tx => {
        if (tx.events) {
          tx.events.forEach(event => {
            if (event.type && event.type.includes('GameCreatedEvent')) {
              createdGames.push({
                data: {
                  game_id: event.data.game_id,
                  creator: event.data.creator,
                  bet_amount: event.data.bet_amount,
                  timestamp: event.data.timestamp || Date.now()
                }
              });
            }
          });
        }
      });
      
      return createdGames;
    } catch (error) {
      console.error('Failed to fetch GameCreated events:', error);
      return [];
    }
  }

  async getGameJoinedEvents() {
    try {
      const response = await this.aptos.getAccountTransactions({
        accountAddress: this.MODULE_ADDRESS,
      });
      
      const joinedGames = [];
      response.forEach(tx => {
        if (tx.events) {
          tx.events.forEach(event => {
            if (event.type && event.type.includes('GameJoinedEvent')) {
              joinedGames.push({
                data: {
                  game_id: event.data.game_id,
                  player: event.data.player,
                  bet_amount: event.data.bet_amount,
                  timestamp: event.data.timestamp || Date.now()
                }
              });
            }
          });
        }
      });
      
      return joinedGames;
    } catch (error) {
      console.error('Failed to fetch GameJoined events:', error);
      return [];
    }
  }

  async getPlayerStats(address) {
    try {
      // Return default stats - view function has issues
      return {
        games_played: 0,
        games_won: 0,
        total_wagered: 0,
        total_winnings: 0
      };
    } catch (error) {
      return {
        games_played: 0,
        games_won: 0,
        total_wagered: 0,
        total_winnings: 0
      };
    }
  }

  async getGame(gameId) {
    try {
      const result = await this.aptos.view({
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::get_game`,
        type_arguments: [],
        arguments: [this.MODULE_ADDRESS, gameId.toString()]
      });

      if (!result || result.length === 0) return null;

      return {
        game_id: gameId,
        player1: result[0],
        player2: result[1],
        bet_amount: result[2],
        state: parseInt(result[3]),
        player1_score: parseInt(result[4]),
        player2_score: parseInt(result[5]),
        winner: result[6]
      };
    } catch (error) {
      console.error('Failed to fetch game:', error);
      return null;
    }
  }

  getBetTiers() {
    return this.BET_TIERS;
  }

  formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  normalizeAddress(address) {
    if (!address) return '';
    return address.toLowerCase().startsWith('0x') ? address.toLowerCase() : `0x${address.toLowerCase()}`;
  }

  compareAddresses(addr1, addr2) {
    return this.normalizeAddress(addr1) === this.normalizeAddress(addr2);
  }
}

export default new MultiplayerGameService();
