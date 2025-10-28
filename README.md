# APT Ninja

<div align="center">



**A blockchain-powered token slicing game built on Starknet**

[![Starknet](https://img.shields.io/badge/Starknet-Sepolia-purple)](https://www.starknet.io/)
[![React](https://img.shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)
[![Cairo](https://img.shields.io/badge/Cairo-2.6.3-orange)](https://www.cairo-lang.org/)


</div>

---

## About The Project

APT Ninja is an interactive blockchain gaming experience that combines fast-paced token slicing gameplay with Web3 technology. Slash flying tokens, avoid bombs, and immortalize your achievements as NFTs on the Starknet blockchain!

###  Key Features

-  **Intuitive Slash Mechanics** - Slice fruits with mouse/touch gestures
-  **Strategic Gameplay** - Avoid bombs and maximize combos
- **NFT Minting** - Mint your high scores as on-chain NFTs
- **Wallet Integration** - Connect with Braavos or Argent X
-  **Achievement System** - Track stats, combos, and personal bests
- **Real-time Scoring** - Dynamic point system with combo multipliers
- **Responsive Design** - Play on desktop or mobile

---

## Tech Stack

### Frontend
- **React 18.2.0** - Modern UI library
- **Starknet.js 6.0.0** - Blockchain interaction
- **Custom Hooks** - Game state management
- **CSS3** - Advanced animations and effects

### Smart Contracts
- **Cairo 2.6.3+** - Smart contract language
- **Scarb** - Build toolchain
- **Starknet Foundry** - Deployment tools

### Blockchain
- **Starknet Sepolia Testnet** - Layer 2 scaling solution
- **NFT Standard (ERC721)** - On-chain achievement storage

---

## 🎯 Game Mechanics

### Scoring System
- **Token Slice**: +10 points
- **Combo Multiplier**: Score × combo count
-  **Bomb Penalty**: Loose life

### NFT Metadata
Each minted NFT stores:
- Final Score
- Maximum Combo Achieved
- Total Tokens Sliced
- Bombs Hit
- Game Duration
- Timestamp

---

##  Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Git
- Starknet wallet (Braavos or Argent X)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/starknet-ninja.git
   cd starknet-ninja
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your values:
   ```env
   REACT_APP_STARKNET_CONTRACT_ADDRESS=0x068fcc36f20d8488949d01a2071dd054153c414b857a06ed32e1ef03be24bdfe
   REACT_APP_STARKNET_NETWORK=sepolia
   REACT_APP_STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
   ```

4. **Start development server**
   ```bash
   npm start
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

---

## Smart Contract Deployment

### Prerequisites
- Scarb 2.6.3+
- Starknet Foundry
- Funded deployer account

### Deploy Contract

1. **Navigate to contracts directory**
   ```bash
   cd contracts
   ```

2. **Build the contract**
   ```bash
   scarb build
   ```

3. **Deploy to Sepolia**
   ```bash
   ./deploy.sh
   ```
   
   Or manually:
   ```bash
   sncast --account deployer \
     declare \
     --contract-name StarkNinjaGameNFT
   
   sncast --account deployer \
     deploy \
     --class-hash <YOUR_CLASS_HASH> \
     --constructor-calldata <OWNER_ADDRESS>
   ```

4. **Update frontend**
   - Copy contract address to `.env`
   - Update `src/contract_abi.json`

---

## How to Play

1. **Connect Wallet**
   - Click "Connect Wallet" button
   - Choose Braavos or Argent X
   - Approve connection

2. **Start Game**
   - Click "Start Playing"
   - Watch for flying tokens
   - Slash tokens, avoid bombs!

3. **Build Combos**
   - Slice multiple fruits rapidly
   - Higher combos = higher scores
   - Don't miss any tokens!

4. **Mint NFT**
   - After game ends, click "Mint Game NFT"
   - Approve transaction in wallet
   - Your achievement is on-chain forever!

5. **View NFT Collection**
   - Click "NFTs" button
   - See all your minted achievements
   - View on Starkscan

---

## 📁 Project Structure

```
starknet-ninja/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── GameScreen.js
│   │   ├── ResultsScreen.js
│   │   ├── StarknetWallet.js
│   │   └── ...
│   ├── hooks/           # Custom React hooks
│   │   ├── useGameState.js
│   │   ├── useSlashDetection.js
│   │   └── ...
│   ├── services/        # Blockchain services
│   │   └── starknetService.js
│   ├── styles/          # CSS files
│   │   └── design-system.css
│   ├── App.js           # Main app component
│   └── index.js         # Entry point
├── contracts/           # Cairo smart contracts
│   ├── src/
│   │   └── lib.cairo
│   ├── Scarb.toml
│   └── deploy.sh
├── .env.example         # Environment template
├── package.json
└── README.md
```

---

##  Deployment

### Deploy to Vercel

**Quick Deploy:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Or use Vercel Dashboard:**
1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Add environment variables
4. Deploy!

**Environment Variables Required:**
- `REACT_APP_STARKNET_CONTRACT_ADDRESS`
- `REACT_APP_STARKNET_NETWORK`
- `REACT_APP_STARKNET_RPC_URL`

See [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) for detailed instructions.

---

## Built With

| Technology | Purpose |
|------------|---------|
| [React](https://reactjs.org/) | Frontend framework |
| [Starknet.js](https://www.starknetjs.com/) | Blockchain SDK |
| [Cairo](https://www.cairo-lang.org/) | Smart contract language |
| [Scarb](https://docs.swmansion.com/scarb/) | Cairo build tool |
| [Vercel](https://vercel.com/) | Hosting platform |

---



## Acknowledgments

- [Starknet](https://www.starknet.io/) - Scaling Ethereum with ZK-rollups
- [OpenZeppelin Cairo Contracts](https://github.com/OpenZeppelin/cairo-contracts)
- [Braavos Wallet](https://braavos.app/)
- [Starkscan](https://sepolia.starkscan.co/) - Starknet block explorer

---

## 🎯 Roadmap

- [x] Basic game mechanics
- [x] Wallet integration
- [x] NFT minting
- [x] Leaderboard system
- [ ] Multiplayer mode
- [ ] Tournament system
- [ ] Custom skins/themes
- [ ] Mobile app (React Native)
- [ ] Mainnet deployment
- [ ] Token rewards

---

## 📊 Stats

**Smart Contract Address:** `0x068fcc36f20d8488949d01a2071dd054153c414b857a06ed32e1ef03be24bdfe`

**Network:** Starknet Sepolia Testnet

**View on Starkscan:** [Contract Details](https://sepolia.starkscan.co/contract/0x068fcc36f20d8488949d01a2071dd054153c414b857a06ed32e1ef03be24bdfe)

---

<div align="center">

**APT Ninja**


</div>
