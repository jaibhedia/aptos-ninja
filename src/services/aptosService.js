import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

class AptosGameService {
  constructor() {
    this.walletConnected = false;
    this.walletAddress = null;
    this.slashBuffer = [];
    this.BATCH_SIZE = 10;
    this.currentTokenId = 0;
    this.gameStartTime = null;
    
    // Initialize Aptos client for testnet
    const config = new AptosConfig({ network: Network.TESTNET });
    this.aptos = new Aptos(config);
    
    // Contract address - UPDATE THIS after deployment
    this.MODULE_ADDRESS = "0xe48c34be75bfd112018e4f35154d4d2756962b20d26f73806833167077c69267";
    this.MODULE_NAME = "game_nft";
    
    // Auto-connect on initialization
    this.autoConnect();
  }

  // Auto-connect wallet if previously connected
  async autoConnect() {
    try {
      if (window.aptos && window.aptos.account) {
        const account = await window.aptos.account();
        if (account && account.address) {
          this.walletAddress = account.address;
          this.walletConnected = true;
          console.log('✅ Wallet auto-connected:', this.walletAddress);
          return true;
        }
      }
    } catch (error) {
      console.log('Wallet not auto-connected');
    }
    return false;
  }

  // Connect wallet using Petra or Martian
  async connectWallet() {
    try {
      console.log('🔵 Starting wallet connection...');
      
      // Check if Aptos wallet is available (Petra wallet)
      if (!window.aptos) {
        console.error('❌ window.aptos not found');
        throw new Error('Please install Petra wallet');
      }

      console.log('✅ window.aptos found');

      // Request connection
      console.log('📞 Calling window.aptos.connect()...');
      const response = await window.aptos.connect();
      console.log('✅ Connection response:', response);
      
      if (!response.address) {
        throw new Error('No address found. Please unlock your wallet.');
      }

      this.walletAddress = response.address;
      this.walletConnected = true;

      console.log('✅ Wallet connected successfully:', this.walletAddress);
      return {
        success: true,
        address: this.walletAddress
      };
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect wallet'
      };
    }
  }

  // Disconnect wallet
  disconnectWallet() {
    try {
      if (window.aptos && window.aptos.disconnect) {
        window.aptos.disconnect();
      }
      this.walletConnected = false;
      this.walletAddress = null;
      console.log('👋 Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }

  // Check if wallet is connected
  isWalletConnected() {
    return this.walletConnected && this.walletAddress !== null;
  }

  // Get wallet address
  getWalletAddress() {
    return this.walletAddress;
  }

  // Start a new game session (local only - no blockchain call)
  async startGameSession() {
    if (!this.isWalletConnected()) {
      console.error('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      console.log('🎮 Starting game session...');
      
      this.gameStartTime = Math.floor(Date.now() / 1000);
      this.slashBuffer = [];
      
      // Generate a unique token ID based on timestamp
      this.currentTokenId = Date.now();

      console.log('✅ Game session started! Token ID:', this.currentTokenId);

      return {
        success: true,
        tokenId: this.currentTokenId,
        message: 'Game started! Play and mint your NFT when done.'
      };
    } catch (error) {
      console.error('❌ Failed to start game session:', error);
      return { success: false, error: error.message || 'Failed to start game' };
    }
  }

  // Record a slash (locally only)
  async recordSlash(slashData) {
    if (!this.isWalletConnected()) {
      console.error('Wallet not connected');
      return;
    }

    this.slashBuffer.push({
      ...slashData,
      timestamp: Math.floor(Date.now() / 1000)
    });

    console.log(`📝 Recorded slash locally. Buffer size: ${this.slashBuffer.length}`);
  }

  // Mint NFT with game results (single transaction)
  async mintGameNFT(gameStats) {
    if (!this.isWalletConnected()) {
      return {
        success: false,
        error: 'Wallet not connected'
      };
    }

    try {
      console.log('🎨 Minting NFT with game stats:', gameStats);

      // Clear the slash buffer
      const totalSlashes = this.slashBuffer.length;
      this.slashBuffer = [];

      // Prepare the transaction payload - calls simplified mint function:
      // mint_game_nft(player, admin_addr, final_score, combo_max, tokens_missed)
      const payload = {
        type: "entry_function_payload",
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::mint_game_nft`,
        type_arguments: [],
        arguments: [
          this.MODULE_ADDRESS,                              // admin_addr
          (gameStats.score || 0).toString(),               // final_score
          (gameStats.comboMax || gameStats.maxCombo || 0).toString(), // combo_max
          (gameStats.tokensMissed || 0).toString(),        // tokens_missed
        ]
      };

      console.log('🎨 Minting NFT with payload:', payload);

      const response = await window.aptos.signAndSubmitTransaction(payload);
      
      console.log('⏳ Waiting for NFT mint confirmation...');
      await this.aptos.waitForTransaction({ transactionHash: response.hash });
      
      console.log('✅ NFT minted successfully! Transaction:', response.hash);
      
      return {
        success: true,
        tokenId: this.currentTokenId,
        transactionHash: response.hash,
        message: `Game NFT minted! Score: ${gameStats.score}, Combo: ${gameStats.comboMax || gameStats.maxCombo}`,
        stats: {
          ...gameStats,
          totalSlashes
        },
        explorerUrl: `https://explorer.aptoslabs.com/txn/${response.hash}?network=testnet`
      };
    } catch (error) {
      console.error('❌ Failed to mint NFT:', error);
      return {
        success: false,
        error: error.message || 'Failed to mint NFT'
      };
    }
  }

  // Get leaderboard from blockchain
  async getLeaderboard() {
    try {
      const resource = await this.aptos.getAccountResource({
        accountAddress: this.MODULE_ADDRESS,
        resourceType: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::Leaderboard`
      });

      return resource.data.top_scores || [];
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return [];
    }
  }

  // Get player stats from blockchain
  async getPlayerStats(address) {
    try {
      const [totalGames, totalScore, totalSlashes, highestScore, nftsMinted] = 
        await this.aptos.view({
          function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::get_player_stats`,
          type_arguments: [],
          arguments: [address]
        });

      return {
        totalGames: parseInt(totalGames),
        totalScore: parseInt(totalScore),
        totalSlashes: parseInt(totalSlashes),
        highestScore: parseInt(highestScore),
        nftsMinted: parseInt(nftsMinted)
      };
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
      return {
        totalGames: 0,
        totalScore: 0,
        totalSlashes: 0,
        highestScore: 0,
        nftsMinted: 0
      };
    }
  }

  // Get game state from blockchain
  async getGameState() {
    try {
      const [totalGames, totalSlashes, nextTokenId] = await this.aptos.view({
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::get_game_state`,
        type_arguments: [],
        arguments: [this.MODULE_ADDRESS]
      });

      return {
        totalGames: parseInt(totalGames),
        totalSlashes: parseInt(totalSlashes),
        nextTokenId: parseInt(nextTokenId)
      };
    } catch (error) {
      console.error('Failed to fetch game state:', error);
      return { totalGames: 0, totalSlashes: 0, nextTokenId: 0 };
    }
  }

  // Get user's NFT count
  async getUserNFTCount(address) {
    try {
      const stats = await this.getPlayerStats(address);
      return stats.nftsMinted;
    } catch (error) {
      console.error('Failed to get NFT count:', error);
      return 0;
    }
  }

  // Get user's NFTs
  async getUserNFTs(address) {
    try {
      console.log(`🖼️  Fetching NFTs for ${address}`);
      
      // Get player stats to find session token IDs
      const resource = await this.aptos.getAccountResource({
        accountAddress: address,
        resourceType: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::PlayerStats`
      });

      const sessions = resource.data.sessions || [];
      
      // Fetch NFT data for each session
      const nfts = await Promise.all(sessions.map(async (tokenId) => {
        try {
          const sessionResource = await this.aptos.getAccountResource({
            accountAddress: address,
            resourceType: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::GameSession`
          });

          return {
            tokenId: parseInt(tokenId),
            score: parseInt(sessionResource.data.score),
            slashes: sessionResource.data.slashes.length,
            timestamp: parseInt(sessionResource.data.start_time)
          };
        } catch (e) {
          return null;
        }
      }));

      return nfts.filter(nft => nft !== null);
    } catch (error) {
      console.error('Failed to fetch NFTs:', error);
      return [];
    }
  }
}

// Create and export singleton instance
const aptosGameService = new AptosGameService();
export default aptosGameService;