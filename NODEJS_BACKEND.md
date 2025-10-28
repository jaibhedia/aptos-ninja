# 🚀 Quick Start - Node.js Backend

## ✅ Done!

Your Node.js backend is ready! Here's what you have:

```
backend/
├── config/
│   ├── aptos.js          # Aptos SDK setup (proper npm package!)
│   └── supabase.js       # Supabase client
├── services/
│   └── blockchainIndexer.js  # Indexes blockchain events every 10s
├── routes/
│   ├── games.js          # Game API endpoints
│   └── players.js        # Player/leaderboard endpoints
├── server.js             # Main Express server
├── package.json          # npm dependencies
└── .env                  # Configuration
```

## 🎯 Next Steps

### 1. Deploy Supabase Schema (if not done)

Go to Supabase Dashboard → SQL Editor → Run this:
```bash
# Copy contents of: ../supabase/schema.sql
```

### 2. Get Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (https://xxxxx.supabase.co)
   - **anon/public** key
   - **service_role** key (secret!)

### 3. Update `.env` File

Edit `backend/.env`:
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Start the Backend

```bash
cd backend
npm run dev
```

You should see:
```
🚀 Aptos Ninja Backend Server
================================
📡 Server running on port 5000
🌐 API: http://localhost:5000
🔌 WebSocket: http://localhost:5000
🎯 Frontend: http://localhost:3000
🔗 Contract: 0xe48c34be75bfd112018e4f35154d4d2756962b20d26f73806833167077c69267
================================

✅ Supabase clients initialized
✅ Aptos SDK initialized
📍 Network: testnet
📍 Contract: 0xe48c34...
🚀 Initializing blockchain indexer...
📊 Starting from version: 0
⏰ Starting indexer cron job (every 10 seconds)...
```

## 🧪 Test It!

### Test API Endpoints

```bash
# Health check
curl http://localhost:5000/health

# Get available games
curl http://localhost:5000/api/games/available

# Get leaderboard
curl http://localhost:5000/api/players/leaderboard/top
```

### Watch Indexer Work

After you create a game in the frontend, watch the backend logs:
```
🔍 Indexing blockchain transactions...
📦 Found 25 total transactions
✨ 1 new transactions to process
🎮 Game created: 1 by 0x123...
✅ Indexed 1 events, version: 12345
```

## 🎮 Update Frontend to Use Backend

Update `src/services/supabaseService.js`:

```javascript
const BACKEND_URL = 'http://localhost:5000';

// Instead of direct Supabase queries, use backend API:
export async function getAvailableGames(betTier = null) {
  const url = betTier 
    ? `${BACKEND_URL}/api/games/available?betTier=${betTier}`
    : `${BACKEND_URL}/api/games/available`;
    
  const response = await fetch(url);
  const data = await response.json();
  return data.games;
}
```

Or keep using Supabase directly from frontend - both work!

## 🔥 What's Better Than Deno?

✅ **Real Aptos SDK** - No import errors!  
✅ **npm packages** - Use any package you want  
✅ **Easy debugging** - Standard Node.js tools  
✅ **Hot reload** - Changes detected automatically  
✅ **Socket.IO** - Better real-time than Supabase alone  
✅ **REST API** - Full control over endpoints  
✅ **Runs locally** - Test everything offline  

## 📊 How It Works

```
1. Backend starts → Connects to Supabase
2. Indexer initializes → Gets last processed version from DB
3. Every 10 seconds → Polls Aptos blockchain
4. Finds events → GameCreated, GameJoined, GameFinished
5. Updates Supabase → Database gets new data
6. Supabase real-time → Notifies all connected clients
7. Frontend updates → Games appear instantly!
```

## 🐛 Troubleshooting

**Backend won't start?**
- Check `.env` has valid Supabase credentials
- Make sure Supabase schema is deployed

**Indexer not working?**
- Check contract address in `.env`
- Verify Aptos testnet is accessible
- Look for error messages in logs

**No games appearing?**
- Create a game in frontend first
- Wait 10 seconds for indexer to run
- Check backend logs for "Game created" message
- Query Supabase Table Editor → games table

## 🎊 You're All Set!

Start the backend:
```bash
npm run dev
```

Then start your frontend:
```bash
cd ..
npm start
```

Create a game and watch it appear in real-time! 🚀
