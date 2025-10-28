// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONTRACT_ADDRESS = "0xe48c34be75bfd112018e4f35154d4d2756962b20d26f73806833167077c69267"
const MODULE_NAME = "multiplayer_game"

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use fetch API to query Aptos node directly
    const aptosNodeUrl = 'https://fullnode.testnet.aptoslabs.com/v1'

    console.log('🔍 Starting blockchain indexer...')

    // Get last processed version
    const { data: indexerState, error: stateError } = await supabaseClient
      .from('indexer_state')
      .select('*')
      .limit(1)
      .single()

    if (stateError && stateError.code !== 'PGRST116') {
      throw stateError
    }

    const lastVersion = indexerState?.last_processed_version || 0
    console.log(`📊 Last processed version: ${lastVersion}`)

    // Fetch new transactions from Aptos using REST API
    const txUrl = `${aptosNodeUrl}/accounts/${CONTRACT_ADDRESS}/transactions?limit=25`
    const txResponse = await fetch(txUrl)
    
    if (!txResponse.ok) {
      throw new Error(`Failed to fetch transactions: ${txResponse.statusText}`)
    }

    const allTransactions = await txResponse.json()
    
    // Filter transactions newer than lastVersion
    const transactions = allTransactions.filter((tx: any) => 
      parseInt(tx.version) > lastVersion
    )

    console.log(`📦 Found ${transactions.length} new transactions`)

    let processedCount = 0
    let newLastVersion = lastVersion

    for (const tx of transactions) {
      if (tx.type !== 'user_transaction') continue
      
      const version = parseInt(tx.version)
      const events = tx.events || []

      for (const event of events) {
        const eventType = event.type.split('::').pop()

        // Log event to database
        await supabaseClient
          .from('event_log')
          .insert({
            event_type: eventType,
            game_id: event.data.game_id ? parseInt(event.data.game_id) : null,
            player_address: event.data.creator || event.data.player || null,
            data: event.data,
            transaction_hash: tx.hash,
            transaction_version: version
          })

        // Process different event types
        if (eventType === 'GameCreatedEvent') {
          await handleGameCreated(supabaseClient, event.data, tx.hash)
        } else if (eventType === 'GameJoinedEvent') {
          await handleGameJoined(supabaseClient, event.data, tx.hash)
        } else if (eventType === 'GameFinishedEvent') {
          await handleGameFinished(supabaseClient, event.data, tx.hash)
        }

        processedCount++
      }

      if (version > newLastVersion) {
        newLastVersion = version
      }
    }

    // Update last processed version
    if (newLastVersion > lastVersion && indexerState) {
      await supabaseClient
        .from('indexer_state')
        .update({ 
          last_processed_version: newLastVersion,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', indexerState.id)
    }

    console.log(`✅ Indexed ${processedCount} events, new version: ${newLastVersion}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        lastVersion: newLastVersion
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Indexer error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function handleGameCreated(supabase: any, data: any, txHash: string) {
  const { game_id, creator, bet_amount } = data
  const betTier = getBetTier(bet_amount)

  console.log(`🎮 Game created: ${game_id} by ${creator}`)

  // Insert game
  await supabase
    .from('games')
    .insert({
      game_id: parseInt(game_id),
      bet_amount: bet_amount.toString(),
      bet_tier: betTier,
      player1_address: creator,
      state: 0,
      creation_tx_hash: txHash
    })

  // Update or create player
  await upsertPlayer(supabase, creator, bet_amount, 'wagered')
}

async function handleGameJoined(supabase: any, data: any, txHash: string) {
  const { game_id, player, bet_amount } = data

  console.log(`👥 Game joined: ${game_id} by ${player}`)

  // Update game
  await supabase
    .from('games')
    .update({
      player2_address: player,
      state: 1,
      joined_at: new Date().toISOString(),
      join_tx_hash: txHash
    })
    .eq('game_id', parseInt(game_id))

  // Update player stats
  await upsertPlayer(supabase, player, bet_amount, 'wagered')
  
  // Increment games played for player 1
  const { data: game } = await supabase
    .from('games')
    .select('player1_address')
    .eq('game_id', parseInt(game_id))
    .single()
  
  if (game) {
    await incrementGamesPlayed(supabase, game.player1_address)
  }
}

async function handleGameFinished(supabase: any, data: any, txHash: string) {
  const { game_id, winner, loser, prize_amount } = data

  console.log(`🏆 Game finished: ${game_id}, winner: ${winner || 'TIE'}`)

  // Update game
  await supabase
    .from('games')
    .update({
      winner_address: winner || null,
      state: 2,
      finished_at: new Date().toISOString(),
      finish_tx_hash: txHash,
      player1_finished: true,
      player2_finished: true
    })
    .eq('game_id', parseInt(game_id))

  // Update winner stats
  if (winner && winner !== '0x0') {
    await upsertPlayer(supabase, winner, prize_amount, 'won')
  }
}

async function upsertPlayer(supabase: any, address: string, amount: string, type: 'wagered' | 'won') {
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('address', address)
    .single()

  if (player) {
    const updates: any = { last_active: new Date().toISOString() }
    
    if (type === 'wagered') {
      updates.total_wagered = (BigInt(player.total_wagered) + BigInt(amount)).toString()
    } else if (type === 'won') {
      updates.games_won = player.games_won + 1
      updates.total_winnings = (BigInt(player.total_winnings) + BigInt(amount)).toString()
    }

    await supabase
      .from('players')
      .update(updates)
      .eq('address', address)
  } else {
    await supabase
      .from('players')
      .insert({
        address,
        games_played: type === 'wagered' ? 1 : 0,
        games_won: type === 'won' ? 1 : 0,
        total_wagered: type === 'wagered' ? amount.toString() : '0',
        total_winnings: type === 'won' ? amount.toString() : '0'
      })
  }
}

async function incrementGamesPlayed(supabase: any, address: string) {
  const { data: player } = await supabase
    .from('players')
    .select('games_played')
    .eq('address', address)
    .single()

  if (player) {
    await supabase
      .from('players')
      .update({ 
        games_played: player.games_played + 1,
        last_active: new Date().toISOString()
      })
      .eq('address', address)
  }
}

function getBetTier(betAmount: string): number {
  const amount = BigInt(betAmount)
  if (amount === BigInt(10000000)) return 1
  if (amount === BigInt(50000000)) return 2
  if (amount === BigInt(100000000)) return 3
  if (amount === BigInt(500000000)) return 4
  return 1
}
