module aptos_ninja::game_nft {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_token::token::{Self, TokenDataId};

    /// Error codes
    const ENOT_INITIALIZED: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;
    const EINVALID_SCORE: u64 = 3;
    const EINSUFFICIENT_PERMISSIONS: u64 = 4;

    /// Collection name
    const COLLECTION_NAME: vector<u8> = b"Aptos Ninja Game Collection";
    const COLLECTION_DESCRIPTION: vector<u8> = b"NFTs representing epic Aptos Ninja game sessions";
    const COLLECTION_URI: vector<u8> = b"https://aptos-ninja.game/collection";

    /// Slash record structure
    struct SlashRecord has store, drop, copy {
        token_type: u8,      // 0: APT, 1: Bomb
        points: u64,
        timestamp: u64,
        velocity_x: u64,
        velocity_y: u64,
    }

    /// Game session data
    struct GameSession has key, store {
        token_id: u64,
        player: address,
        score: u64,
        slashes: vector<SlashRecord>,
        bombs_hit: u64,
        tokens_missed: u64,
        combo_max: u64,
        start_time: u64,
        end_time: u64,
        nft_minted: bool,
    }

    /// Global game state
    struct GameState has key {
        total_games: u64,
        total_slashes: u64,
        next_token_id: u64,
        collection_created: bool,
        game_created_events: EventHandle<GameCreatedEvent>,
        slash_recorded_events: EventHandle<SlashRecordedEvent>,
        nft_minted_events: EventHandle<NFTMintedEvent>,
    }

    /// Leaderboard entry
    struct LeaderboardEntry has store, drop, copy {
        player: address,
        score: u64,
        token_id: u64,
        timestamp: u64,
    }

    /// Global leaderboard
    struct Leaderboard has key {
        top_scores: vector<LeaderboardEntry>,
        max_entries: u64,
    }

    /// Player stats
    struct PlayerStats has key {
        total_games: u64,
        total_score: u64,
        total_slashes: u64,
        highest_score: u64,
        nfts_minted: u64,
        sessions: vector<u64>, // token IDs
    }

    /// Events
    struct GameCreatedEvent has drop, store {
        token_id: u64,
        player: address,
        timestamp: u64,
    }

    struct SlashRecordedEvent has drop, store {
        token_id: u64,
        player: address,
        token_type: u8,
        points: u64,
        timestamp: u64,
    }

    struct NFTMintedEvent has drop, store {
        token_id: u64,
        player: address,
        score: u64,
        token_data_id: TokenDataId,
        timestamp: u64,
    }

    /// Initialize the game module
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        assert!(
            !exists<GameState>(admin_addr),
            error::already_exists(EALREADY_INITIALIZED)
        );

        // Create game state
        move_to(admin, GameState {
            total_games: 0,
            total_slashes: 0,
            next_token_id: 1,
            collection_created: false,
            game_created_events: account::new_event_handle<GameCreatedEvent>(admin),
            slash_recorded_events: account::new_event_handle<SlashRecordedEvent>(admin),
            nft_minted_events: account::new_event_handle<NFTMintedEvent>(admin),
        });

        // Create leaderboard
        move_to(admin, Leaderboard {
            top_scores: vector::empty<LeaderboardEntry>(),
            max_entries: 100,
        });
    }

    /// Create NFT collection (one-time setup)
    public entry fun create_collection(admin: &signer) acquires GameState {
        let admin_addr = signer::address_of(admin);
        let game_state = borrow_global_mut<GameState>(admin_addr);
        
        assert!(!game_state.collection_created, error::already_exists(EALREADY_INITIALIZED));

        token::create_collection(
            admin,
            string::utf8(COLLECTION_NAME),
            string::utf8(COLLECTION_DESCRIPTION),
            string::utf8(COLLECTION_URI),
            1000000, // max supply
            vector<bool>[false, false, false], // mutability config
        );

        game_state.collection_created = true;
    }

    /// Start a new game session
    public entry fun start_game(player: &signer, admin_addr: address) acquires GameState, PlayerStats {
        let player_addr = signer::address_of(player);
        let game_state = borrow_global_mut<GameState>(admin_addr);
        
        let token_id = game_state.next_token_id;
        game_state.next_token_id = token_id + 1;
        game_state.total_games = game_state.total_games + 1;

        // Initialize player stats if needed
        if (!exists<PlayerStats>(player_addr)) {
            move_to(player, PlayerStats {
                total_games: 0,
                total_score: 0,
                total_slashes: 0,
                highest_score: 0,
                nfts_minted: 0,
                sessions: vector::empty<u64>(),
            });
        };

        // Create game session
        let session = GameSession {
            token_id,
            player: player_addr,
            score: 0,
            slashes: vector::empty<SlashRecord>(),
            bombs_hit: 0,
            tokens_missed: 0,
            combo_max: 0,
            start_time: timestamp::now_seconds(),
            end_time: 0,
            nft_minted: false,
        };

        // Store session with unique key using token_id
        let session_key = token_id;
        move_to(player, session);

        // Update player stats
        let player_stats = borrow_global_mut<PlayerStats>(player_addr);
        player_stats.total_games = player_stats.total_games + 1;
        vector::push_back(&mut player_stats.sessions, token_id);

        // Emit event
        event::emit_event(&mut game_state.game_created_events, GameCreatedEvent {
            token_id,
            player: player_addr,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Record a slash during gameplay
    public entry fun record_slash(
        player: &signer,
        admin_addr: address,
        token_id: u64,
        token_type: u8,
        points: u64,
        velocity_x: u64,
        velocity_y: u64,
    ) acquires GameSession, GameState, PlayerStats {
        let player_addr = signer::address_of(player);
        
        assert!(exists<GameSession>(player_addr), error::not_found(ENOT_INITIALIZED));
        
        let session = borrow_global_mut<GameSession>(player_addr);
        assert!(session.token_id == token_id, error::invalid_argument(EINVALID_SCORE));

        // Create slash record
        let slash = SlashRecord {
            token_type,
            points,
            timestamp: timestamp::now_seconds(),
            velocity_x,
            velocity_y,
        };

        vector::push_back(&mut session.slashes, slash);
        
        // Update score based on token type
        if (token_type == 0) {
            // APT token
            session.score = session.score + points;
        } else {
            // Bomb - deduct points
            session.bombs_hit = session.bombs_hit + 1;
            if (session.score >= points) {
                session.score = session.score - points;
            } else {
                session.score = 0;
            };
        };

        // Update global stats
        let game_state = borrow_global_mut<GameState>(admin_addr);
        game_state.total_slashes = game_state.total_slashes + 1;

        // Update player stats
        let player_stats = borrow_global_mut<PlayerStats>(player_addr);
        player_stats.total_slashes = player_stats.total_slashes + 1;

        // Emit event
        event::emit_event(&mut game_state.slash_recorded_events, SlashRecordedEvent {
            token_id,
            player: player_addr,
            token_type,
            points,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// End game and mint NFT
    public entry fun end_game_and_mint_nft(
        player: &signer,
        admin_addr: address,
        token_id: u64,
        final_score: u64,
        combo_max: u64,
        tokens_missed: u64,
    ) acquires GameSession, GameState, PlayerStats, Leaderboard {
        let player_addr = signer::address_of(player);
        
        assert!(exists<GameSession>(player_addr), error::not_found(ENOT_INITIALIZED));
        
        let session = borrow_global_mut<GameSession>(player_addr);
        assert!(session.token_id == token_id, error::invalid_argument(EINVALID_SCORE));
        assert!(!session.nft_minted, error::already_exists(EALREADY_INITIALIZED));

        // Update session
        session.end_time = timestamp::now_seconds();
        session.score = final_score;
        session.combo_max = combo_max;
        session.tokens_missed = tokens_missed;
        session.nft_minted = true;

        // Update player stats
        let player_stats = borrow_global_mut<PlayerStats>(player_addr);
        player_stats.total_score = player_stats.total_score + final_score;
        if (final_score > player_stats.highest_score) {
            player_stats.highest_score = final_score;
        };
        player_stats.nfts_minted = player_stats.nfts_minted + 1;

        // Mint NFT
        let token_name = string::utf8(b"Aptos Ninja Game #");
        string::append(&mut token_name, u64_to_string(token_id));
        
        let description = string::utf8(b"Score: ");
        string::append(&mut description, u64_to_string(final_score));
        string::append(&mut description, string::utf8(b" | Slashes: "));
        string::append(&mut description, u64_to_string(vector::length(&session.slashes)));
        
        let token_uri = string::utf8(b"https://aptos-ninja.game/nft/");
        string::append(&mut token_uri, u64_to_string(token_id));

        let token_data_id = token::create_tokendata(
            player,
            string::utf8(COLLECTION_NAME),
            token_name,
            description,
            1, // max supply for this token
            token_uri,
            player_addr, // royalty payee
            100, // royalty denominator
            5, // royalty numerator (5%)
            token::create_token_mutability_config(&vector<bool>[false, false, false, false, false]),
            vector::empty<String>(),
            vector::empty<vector<u8>>(),
            vector::empty<String>(),
        );

        token::mint_token(
            player,
            token_data_id,
            1, // amount
        );

        // Update leaderboard
        update_leaderboard(admin_addr, player_addr, final_score, token_id);

        // Emit event
        let game_state = borrow_global_mut<GameState>(admin_addr);
        event::emit_event(&mut game_state.nft_minted_events, NFTMintedEvent {
            token_id,
            player: player_addr,
            score: final_score,
            token_data_id,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Update leaderboard with new score
    fun update_leaderboard(
        admin_addr: address,
        player: address,
        score: u64,
        token_id: u64,
    ) acquires Leaderboard {
        let leaderboard = borrow_global_mut<Leaderboard>(admin_addr);
        
        let entry = LeaderboardEntry {
            player,
            score,
            token_id,
            timestamp: timestamp::now_seconds(),
        };

        let len = vector::length(&leaderboard.top_scores);
        let inserted = false;
        let i = 0;

        // Insert in sorted order (highest score first)
        while (i < len && !inserted) {
            let current = vector::borrow(&leaderboard.top_scores, i);
            if (score > current.score) {
                vector::insert(&mut leaderboard.top_scores, i, entry);
                inserted = true;
            };
            i = i + 1;
        };

        // If not inserted and under max entries, add to end
        if (!inserted && len < leaderboard.max_entries) {
            vector::push_back(&mut leaderboard.top_scores, entry);
        };

        // Trim if over max entries
        let current_len = vector::length(&leaderboard.top_scores);
        if (current_len > leaderboard.max_entries) {
            vector::pop_back(&mut leaderboard.top_scores);
        };
    }

    /// Helper function to convert u64 to string
    fun u64_to_string(num: u64): String {
        if (num == 0) {
            return string::utf8(b"0")
        };
        
        let digits = vector::empty<u8>();
        let n = num;
        
        while (n > 0) {
            let digit = ((n % 10) as u8) + 48; // ASCII '0' is 48
            vector::push_back(&mut digits, digit);
            n = n / 10;
        };
        
        vector::reverse(&mut digits);
        string::utf8(digits)
    }

    /// Simplified mint function - creates session and mints NFT in one transaction
    public entry fun mint_game_nft(
        player: &signer,
        admin_addr: address,
        final_score: u64,
        combo_max: u64,
        tokens_missed: u64,
    ) acquires GameState, PlayerStats, Leaderboard {
        let player_addr = signer::address_of(player);
        let game_state = borrow_global_mut<GameState>(admin_addr);
        
        let token_id = game_state.next_token_id;
        game_state.next_token_id = token_id + 1;
        game_state.total_games = game_state.total_games + 1;

        // Initialize player stats if needed
        if (!exists<PlayerStats>(player_addr)) {
            move_to(player, PlayerStats {
                total_games: 0,
                total_score: 0,
                total_slashes: 0,
                highest_score: 0,
                nfts_minted: 0,
                sessions: vector::empty<u64>(),
            });
        };

        // Update player stats
        let player_stats = borrow_global_mut<PlayerStats>(player_addr);
        player_stats.total_games = player_stats.total_games + 1;
        player_stats.total_score = player_stats.total_score + final_score;
        if (final_score > player_stats.highest_score) {
            player_stats.highest_score = final_score;
        };
        player_stats.nfts_minted = player_stats.nfts_minted + 1;
        vector::push_back(&mut player_stats.sessions, token_id);

        // Create collection for player if this is their first NFT
        if (player_stats.nfts_minted == 1) {
            token::create_collection(
                player,
                string::utf8(COLLECTION_NAME),
                string::utf8(COLLECTION_DESCRIPTION),
                string::utf8(COLLECTION_URI),
                1000000, // max supply
                vector<bool>[false, false, false], // mutability config
            );
        };

        // Mint NFT
        let token_name = string::utf8(b"Aptos Ninja Game #");
        string::append(&mut token_name, u64_to_string(token_id));
        
        let description = string::utf8(b"Score: ");
        string::append(&mut description, u64_to_string(final_score));
        string::append(&mut description, string::utf8(b" | Combo: "));
        string::append(&mut description, u64_to_string(combo_max));
        
        let token_uri = string::utf8(b"https://aptos-ninja.game/nft/");
        string::append(&mut token_uri, u64_to_string(token_id));

        let token_data_id = token::create_tokendata(
            player,
            string::utf8(COLLECTION_NAME),
            token_name,
            description,
            1, // max supply for this token
            token_uri,
            player_addr, // royalty payee
            100, // royalty denominator
            5, // royalty numerator (5%)
            token::create_token_mutability_config(&vector<bool>[false, false, false, false, false]),
            vector::empty<String>(),
            vector::empty<vector<u8>>(),
            vector::empty<String>(),
        );

        token::mint_token(
            player,
            token_data_id,
            1, // amount
        );

        // Update leaderboard
        update_leaderboard(admin_addr, player_addr, final_score, token_id);

        // Emit event
        event::emit_event(&mut game_state.nft_minted_events, NFTMintedEvent {
            token_id,
            player: player_addr,
            score: final_score,
            token_data_id,
            timestamp: timestamp::now_seconds(),
        });
    }

    // View functions
    #[view]
    public fun get_player_stats(player: address): (u64, u64, u64, u64, u64) acquires PlayerStats {
        if (!exists<PlayerStats>(player)) {
            return (0, 0, 0, 0, 0)
        };
        
        let stats = borrow_global<PlayerStats>(player);
        (
            stats.total_games,
            stats.total_score,
            stats.total_slashes,
            stats.highest_score,
            stats.nfts_minted,
        )
    }

    #[view]
    public fun get_game_state(admin_addr: address): (u64, u64, u64) acquires GameState {
        let state = borrow_global<GameState>(admin_addr);
        (state.total_games, state.total_slashes, state.next_token_id)
    }

    #[view]
    public fun get_session_score(player: address, token_id: u64): u64 acquires GameSession {
        let session = borrow_global<GameSession>(player);
        session.score
    }
}
