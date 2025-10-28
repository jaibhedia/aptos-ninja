module aptos_ninja::multiplayer_game {
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::account;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_GAME_NOT_FOUND: u64 = 3;
    const E_GAME_ALREADY_STARTED: u64 = 4;
    const E_NOT_YOUR_GAME: u64 = 5;
    const E_GAME_NOT_IN_PROGRESS: u64 = 6;
    const E_ALREADY_SUBMITTED: u64 = 7;
    const E_INVALID_BET_TIER: u64 = 8;
    const E_INSUFFICIENT_BALANCE: u64 = 9;
    const E_GAME_FULL: u64 = 10;
    const E_CANNOT_JOIN_OWN_GAME: u64 = 11;

    // Bet tiers (in octas, 1 APT = 100,000,000 octas)
    const BET_TIER_1: u64 = 10000000;    // 0.1 APT (~$0.70)
    const BET_TIER_2: u64 = 50000000;    // 0.5 APT (~$3.50)
    const BET_TIER_3: u64 = 100000000;   // 1 APT (~$7)
    const BET_TIER_4: u64 = 500000000;   // 5 APT (~$35)

    // Game states
    const STATE_WAITING: u8 = 0;
    const STATE_IN_PROGRESS: u8 = 1;
    const STATE_FINISHED: u8 = 2;
    const STATE_CANCELLED: u8 = 3;

    struct MultiplayerGame has store, drop, copy {
        game_id: u64,
        bet_amount: u64,
        player1: address,
        player2: address,
        player1_score: u64,
        player2_score: u64,
        player1_finished: bool,
        player2_finished: bool,
        winner: address,
        state: u8,
        created_at: u64,
        finished_at: u64,
    }

    struct GameLobby has key {
        games: vector<MultiplayerGame>,
        next_game_id: u64,
        total_games_played: u64,
        total_volume: u64,
        signer_cap: account::SignerCapability,  // For escrow
    }
    
    /// Escrow account to hold game funds
    struct GameEscrow has key {
        coins: Coin<AptosCoin>,
    }

    struct PlayerStats has key {
        games_played: u64,
        games_won: u64,
        total_wagered: u64,
        total_winnings: u64,
        current_game_id: u64,
    }

    #[event]
    struct GameCreatedEvent has drop, store {
        game_id: u64,
        creator: address,
        bet_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct GameJoinedEvent has drop, store {
        game_id: u64,
        player: address,
        bet_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct GameFinishedEvent has drop, store {
        game_id: u64,
        winner: address,
        prize: u64,
        timestamp: u64,
    }

    /// Initialize the game lobby with resource account for escrow
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<GameLobby>(admin_addr), E_ALREADY_INITIALIZED);
        
        // Create resource account for holding game funds
        let (escrow_signer, signer_cap) = account::create_resource_account(admin, b"game_escrow");
        let escrow_addr = signer::address_of(&escrow_signer);
        
        // Register the escrow account for AptosCoin
        coin::register<AptosCoin>(&escrow_signer);
        
        // Initialize escrow
        move_to(&escrow_signer, GameEscrow {
            coins: coin::zero<AptosCoin>(),
        });

        move_to(admin, GameLobby {
            games: vector::empty(),
            next_game_id: 1,
            total_games_played: 0,
            total_volume: 0,
            signer_cap,
        });
    }

    /// Create a new multiplayer game
    public entry fun create_game(
        player: &signer,
        admin_addr: address,
        bet_tier: u64
    ) acquires GameLobby, PlayerStats, GameEscrow {
        let player_addr = signer::address_of(player);
        assert!(exists<GameLobby>(admin_addr), E_NOT_INITIALIZED);
        
        // Determine bet amount
        let bet_amount = if (bet_tier == 1) { BET_TIER_1 }
        else if (bet_tier == 2) { BET_TIER_2 }
        else if (bet_tier == 3) { BET_TIER_3 }
        else if (bet_tier == 4) { BET_TIER_4 }
        else { abort E_INVALID_BET_TIER };

        // Check player has sufficient balance
        assert!(coin::balance<AptosCoin>(player_addr) >= bet_amount, E_INSUFFICIENT_BALANCE);

        // Initialize player stats if needed
        if (!exists<PlayerStats>(player_addr)) {
            move_to(player, PlayerStats {
                games_played: 0,
                games_won: 0,
                total_wagered: 0,
                total_winnings: 0,
                current_game_id: 0,
            });
        };

        let lobby = borrow_global_mut<GameLobby>(admin_addr);
        let game_id = lobby.next_game_id;
        
        // Get escrow signer
        let escrow_signer = account::create_signer_with_capability(&lobby.signer_cap);
        let escrow_addr = signer::address_of(&escrow_signer);
        
        // Deposit bet to escrow
        let escrow = borrow_global_mut<GameEscrow>(escrow_addr);
        let deposited = coin::withdraw<AptosCoin>(player, bet_amount);
        coin::merge(&mut escrow.coins, deposited);

        // Create new game
        let game = MultiplayerGame {
            game_id,
            bet_amount,
            player1: player_addr,
            player2: @0x0,
            player1_score: 0,
            player2_score: 0,
            player1_finished: false,
            player2_finished: false,
            winner: @0x0,
            state: STATE_WAITING,
            created_at: timestamp::now_seconds(),
            finished_at: 0,
        };

        vector::push_back(&mut lobby.games, game);
        lobby.next_game_id = lobby.next_game_id + 1;

        // Update player stats
        let player_stats = borrow_global_mut<PlayerStats>(player_addr);
        player_stats.current_game_id = game_id;
        player_stats.total_wagered = player_stats.total_wagered + bet_amount;

        // Emit event
        event::emit(GameCreatedEvent {
            game_id,
            creator: player_addr,
            bet_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Join an existing game
    public entry fun join_game(
        player: &signer,
        admin_addr: address,
        game_id: u64
    ) acquires GameLobby, PlayerStats, GameEscrow {
        let player_addr = signer::address_of(player);
        assert!(exists<GameLobby>(admin_addr), E_NOT_INITIALIZED);

        let lobby = borrow_global_mut<GameLobby>(admin_addr);
        let game_index = find_game_index(&lobby.games, game_id);
        assert!(game_index < vector::length(&lobby.games), E_GAME_NOT_FOUND);

        let game = vector::borrow_mut(&mut lobby.games, game_index);
        assert!(game.state == STATE_WAITING, E_GAME_ALREADY_STARTED);
        assert!(game.player2 == @0x0, E_GAME_FULL);
        assert!(game.player1 != player_addr, E_CANNOT_JOIN_OWN_GAME);
        
        // Check player has sufficient balance
        assert!(coin::balance<AptosCoin>(player_addr) >= game.bet_amount, E_INSUFFICIENT_BALANCE);

        // Initialize player stats if needed
        if (!exists<PlayerStats>(player_addr)) {
            move_to(player, PlayerStats {
                games_played: 0,
                games_won: 0,
                total_wagered: 0,
                total_winnings: 0,
                current_game_id: 0,
            });
        };

        // Get escrow and deposit bet
        let escrow_signer = account::create_signer_with_capability(&lobby.signer_cap);
        let escrow_addr = signer::address_of(&escrow_signer);
        
        let escrow = borrow_global_mut<GameEscrow>(escrow_addr);
        let deposited = coin::withdraw<AptosCoin>(player, game.bet_amount);
        coin::merge(&mut escrow.coins, deposited);

        // Update game
        game.player2 = player_addr;
        game.state = STATE_IN_PROGRESS;

        // Update player stats
        let player_stats = borrow_global_mut<PlayerStats>(player_addr);
        player_stats.current_game_id = game_id;
        player_stats.total_wagered = player_stats.total_wagered + game.bet_amount;

        lobby.total_volume = lobby.total_volume + (game.bet_amount * 2);

        // Emit event
        event::emit(GameJoinedEvent {
            game_id,
            player: player_addr,
            bet_amount: game.bet_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Submit final score
    public entry fun submit_score(
        player: &signer,
        admin_addr: address,
        game_id: u64,
        final_score: u64
    ) acquires GameLobby, PlayerStats, GameEscrow {
        let player_addr = signer::address_of(player);
        assert!(exists<GameLobby>(admin_addr), E_NOT_INITIALIZED);

        let lobby = borrow_global_mut<GameLobby>(admin_addr);
        let game_index = find_game_index(&lobby.games, game_id);
        assert!(game_index < vector::length(&lobby.games), E_GAME_NOT_FOUND);

        let game = vector::borrow_mut(&mut lobby.games, game_index);
        assert!(game.state == STATE_IN_PROGRESS, E_GAME_NOT_IN_PROGRESS);
        assert!(player_addr == game.player1 || player_addr == game.player2, E_NOT_YOUR_GAME);

        // Record score
        if (player_addr == game.player1) {
            assert!(!game.player1_finished, E_ALREADY_SUBMITTED);
            game.player1_score = final_score;
            game.player1_finished = true;
        } else {
            assert!(!game.player2_finished, E_ALREADY_SUBMITTED);
            game.player2_score = final_score;
            game.player2_finished = true;
        };

        // If both players submitted, finish the game
        if (game.player1_finished && game.player2_finished) {
            finish_game(lobby, game_index, admin_addr);
        };
    }

    /// Helper function to finish a game and distribute prizes
    fun finish_game(lobby: &mut GameLobby, game_index: u64, admin_addr: address) acquires PlayerStats, GameEscrow {
        let game = vector::borrow_mut(&mut lobby.games, game_index);
        game.state = STATE_FINISHED;
        game.finished_at = timestamp::now_seconds();

        // Get escrow
        let escrow_signer = account::create_signer_with_capability(&lobby.signer_cap);
        let escrow_addr = signer::address_of(&escrow_signer);
        let escrow = borrow_global_mut<GameEscrow>(escrow_addr);

        // Determine winner
        let (winner, loser) = if (game.player1_score > game.player2_score) {
            (game.player1, game.player2)
        } else if (game.player2_score > game.player1_score) {
            (game.player2, game.player1)
        } else {
            // Tie - refund both players
            let refund = coin::extract(&mut escrow.coins, game.bet_amount);
            coin::deposit(game.player1, refund);
            
            let refund2 = coin::extract(&mut escrow.coins, game.bet_amount);
            coin::deposit(game.player2, refund2);
            
            game.winner = @0x0;
            
            // Update stats
            let p1_stats = borrow_global_mut<PlayerStats>(game.player1);
            p1_stats.games_played = p1_stats.games_played + 1;
            p1_stats.current_game_id = 0;

            let p2_stats = borrow_global_mut<PlayerStats>(game.player2);
            p2_stats.games_played = p2_stats.games_played + 1;
            p2_stats.current_game_id = 0;
            
            lobby.total_games_played = lobby.total_games_played + 1;
            return
        };

        game.winner = winner;
        let prize = game.bet_amount * 2;

        // Transfer prize to winner from escrow
        let prize_coins = coin::extract(&mut escrow.coins, prize);
        coin::deposit(winner, prize_coins);

        // Update stats
        let winner_stats = borrow_global_mut<PlayerStats>(winner);
        winner_stats.games_played = winner_stats.games_played + 1;
        winner_stats.games_won = winner_stats.games_won + 1;
        winner_stats.total_winnings = winner_stats.total_winnings + prize;
        winner_stats.current_game_id = 0;

        let loser_stats = borrow_global_mut<PlayerStats>(loser);
        loser_stats.games_played = loser_stats.games_played + 1;
        loser_stats.current_game_id = 0;

        lobby.total_games_played = lobby.total_games_played + 1;

        // Emit event
        event::emit(GameFinishedEvent {
            game_id: game.game_id,
            winner,
            prize,
            timestamp: timestamp::now_seconds(),
        });
    }

    // View functions
    
    #[view]
    public fun get_available_games(admin_addr: address): vector<MultiplayerGame> acquires GameLobby {
        assert!(exists<GameLobby>(admin_addr), E_NOT_INITIALIZED);
        let lobby = borrow_global<GameLobby>(admin_addr);
        
        let available = vector::empty<MultiplayerGame>();
        let i = 0;
        let len = vector::length(&lobby.games);
        
        while (i < len) {
            let game = *vector::borrow(&lobby.games, i);
            if (game.state == STATE_WAITING) {
                vector::push_back(&mut available, game);
            };
            i = i + 1;
        };
        
        available
    }

    #[view]
    public fun get_player_stats(player_addr: address): (u64, u64, u64, u64, u64) acquires PlayerStats {
        if (!exists<PlayerStats>(player_addr)) {
            return (0, 0, 0, 0, 0)
        };
        
        let stats = borrow_global<PlayerStats>(player_addr);
        (
            stats.games_played,
            stats.games_won,
            stats.total_wagered,
            stats.total_winnings,
            stats.current_game_id
        )
    }

    #[view]
    public fun get_game(admin_addr: address, game_id: u64): MultiplayerGame acquires GameLobby {
        assert!(exists<GameLobby>(admin_addr), E_NOT_INITIALIZED);
        let lobby = borrow_global<GameLobby>(admin_addr);
        let index = find_game_index(&lobby.games, game_id);
        assert!(index < vector::length(&lobby.games), E_GAME_NOT_FOUND);
        *vector::borrow(&lobby.games, index)
    }

    // Helper functions
    
    fun find_game_index(games: &vector<MultiplayerGame>, game_id: u64): u64 {
        let i = 0;
        let len = vector::length(games);
        while (i < len) {
            let game = vector::borrow(games, i);
            if (game.game_id == game_id) {
                return i
            };
            i = i + 1;
        };
        len  // Return length if not found
    }
}
