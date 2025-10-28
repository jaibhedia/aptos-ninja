import { aptos, CONTRACT_ADDRESS, MODULE_NAME } from '../config/aptos.js';
import { supabaseAdmin } from '../config/supabase.js';
import cron from 'node-cron';

class BlockchainIndexer {
  constructor() {
    this.isRunning = false;
    this.lastProcessedVersion = 0;
  }

  async initialize() {
    console.log('🚀 Initializing blockchain indexer...');
    
    // Get last processed version from database
    const { data, error } = await supabaseAdmin
      .from('indexer_state')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching indexer state:', error);
      this.lastProcessedVersion = 0;
    } else {
      this.lastProcessedVersion = data?.last_processed_version || 0;
    }

    console.log(`📊 Starting from version: ${this.lastProcessedVersion}`);
  }

  async indexTransactions() {
    if (this.isRunning) {
      console.log('⏭️  Indexer already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      // Fetch account transactions
      const transactions = await aptos.getAccountTransactions({
        accountAddress: CONTRACT_ADDRESS,
        options: {
          limit: 25
        }
      });

      // Filter transactions newer than last processed
      const newTransactions = transactions.filter(tx => 
        parseInt(tx.version) > this.lastProcessedVersion
      );

      let processedCount = 0;
      let newLastVersion = this.lastProcessedVersion;

      for (const tx of newTransactions) {
        if (tx.type !== 'user_transaction') continue;

        const version = parseInt(tx.version);
        const events = tx.events || [];

        for (const event of events) {
          const eventType = event.type.split('::').pop();

          // Log event to database
          await supabaseAdmin
            .from('event_log')
            .insert({
              event_type: eventType,
              game_id: event.data.game_id ? parseInt(event.data.game_id) : null,
              player_address: event.data.creator || event.data.player || null,
              data: event.data,
              transaction_hash: tx.hash,
              transaction_version: version
            });

          // Process different event types
          if (eventType === 'GameCreatedEvent') {
            await this.handleGameCreated(event.data, tx.hash);
          } else if (eventType === 'GameJoinedEvent') {
            await this.handleGameJoined(event.data, tx.hash);
          } else if (eventType === 'GameFinishedEvent') {
            await this.handleGameFinished(event.data, tx.hash);
          }

          processedCount++;
        }

        if (version > newLastVersion) {
          newLastVersion = version;
        }
      }

      // Update last processed version
      if (newLastVersion > this.lastProcessedVersion) {
        const { data: stateData } = await supabaseAdmin
          .from('indexer_state')
          .select('id')
          .limit(1)
          .single();

        if (stateData) {
          await supabaseAdmin
            .from('indexer_state')
            .update({
              last_processed_version: newLastVersion,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', stateData.id);
        }

        this.lastProcessedVersion = newLastVersion;
      }

      if (processedCount > 0) {
        console.log(`✅ Indexed ${processedCount} events, version: ${newLastVersion}`);
      }

    } catch (error) {
      console.error('❌ Indexer error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async handleGameCreated(data, txHash) {
    const { game_id, creator, bet_amount } = data;
    const betTier = this.getBetTier(bet_amount);

    console.log(`🎮 Game created: ${game_id} by ${creator}`);

    // Insert game
    await supabaseAdmin
      .from('games')
      .insert({
        game_id: parseInt(game_id),
        bet_amount: bet_amount.toString(),
        bet_tier: betTier,
        player1_address: creator,
        state: 0,
        creation_tx_hash: txHash
      });

    // Update or create player
    await this.upsertPlayer(creator, bet_amount, 'wagered');
  }

  async handleGameJoined(data, txHash) {
    const { game_id, player, bet_amount } = data;

    console.log(`👥 Game joined: ${game_id} by ${player}`);

    // Update game
    await supabaseAdmin
      .from('games')
      .update({
        player2_address: player,
        state: 1,
        joined_at: new Date().toISOString(),
        join_tx_hash: txHash
      })
      .eq('game_id', parseInt(game_id));

    // Update player stats
    await this.upsertPlayer(player, bet_amount, 'wagered');

    // Increment games played for player 1
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('player1_address')
      .eq('game_id', parseInt(game_id))
      .single();

    if (game) {
      await this.incrementGamesPlayed(game.player1_address);
    }
  }

  async handleGameFinished(data, txHash) {
    const { game_id, winner, loser, prize_amount } = data;

    console.log(`🏆 Game finished: ${game_id}, winner: ${winner || 'TIE'}`);

    // Update game
    await supabaseAdmin
      .from('games')
      .update({
        winner_address: winner || null,
        state: 2,
        finished_at: new Date().toISOString(),
        finish_tx_hash: txHash,
        player1_finished: true,
        player2_finished: true
      })
      .eq('game_id', parseInt(game_id));

    // Update winner stats
    if (winner && winner !== '0x0') {
      await this.upsertPlayer(winner, prize_amount, 'won');
    }
  }

  async upsertPlayer(address, amount, type) {
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('address', address)
      .single();

    if (player) {
      const updates = { last_active: new Date().toISOString() };

      if (type === 'wagered') {
        updates.total_wagered = (BigInt(player.total_wagered) + BigInt(amount)).toString();
      } else if (type === 'won') {
        updates.games_won = player.games_won + 1;
        updates.total_winnings = (BigInt(player.total_winnings) + BigInt(amount)).toString();
      }

      await supabaseAdmin
        .from('players')
        .update(updates)
        .eq('address', address);
    } else {
      await supabaseAdmin
        .from('players')
        .insert({
          address,
          games_played: type === 'wagered' ? 1 : 0,
          games_won: type === 'won' ? 1 : 0,
          total_wagered: type === 'wagered' ? amount.toString() : '0',
          total_winnings: type === 'won' ? amount.toString() : '0'
        });
    }
  }

  async incrementGamesPlayed(address) {
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('games_played')
      .eq('address', address)
      .single();

    if (player) {
      await supabaseAdmin
        .from('players')
        .update({
          games_played: player.games_played + 1,
          last_active: new Date().toISOString()
        })
        .eq('address', address);
    }
  }

  getBetTier(betAmount) {
    const amount = BigInt(betAmount);
    if (amount === BigInt(10000000)) return 1;
    if (amount === BigInt(50000000)) return 2;
    if (amount === BigInt(100000000)) return 3;
    if (amount === BigInt(500000000)) return 4;
    return 1;
  }

  startCron() {
    console.log('⏰ Starting indexer cron job (every 10 seconds)...');
    
    // Run every 10 seconds
    cron.schedule('*/10 * * * * *', async () => {
      await this.indexTransactions();
    });
  }

  async runOnce() {
    await this.initialize();
    await this.indexTransactions();
  }

  async start() {
    await this.initialize();
    await this.indexTransactions(); // Run once immediately
    this.startCron(); // Then run every 10 seconds
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexer = new BlockchainIndexer();
  indexer.start();
}

export default BlockchainIndexer;
