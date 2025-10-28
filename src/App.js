import React, { useState, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';
import ParticleContainer from './components/ParticleContainer';
import LandingPage from './components/LandingPage';
import { useGameState } from './hooks/useGameState';
import { useTaskbarControls } from './hooks/useTaskbarControls';
import { useAptos } from './hooks/useAptos';
import './App.css';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"

function App() {
  const {
    gameState,
    startGame,
    endGame,
    showStartScreen,
    updateScore,
    loseLife,
    loseLiveFromMissedToken,
    togglePause,
    createScreenFlash
  } = useGameState();

  // Aptos wallet and blockchain integration
  const aptos = useAptos();
  const [particles, setParticles] = useState([]);
  const [showLanding, setShowLanding] = useState(true);

  // Add taskbar controls
  useTaskbarControls(gameState, togglePause);

  const handleCreateParticles = useCallback((x, y, color, count) => {
    const newParticles = [];
    // Create fewer, token-based particles
    const tokenEmojis =  ['⭐', '✨', '💰'];
    const tokenCount = Math.min(count, 8); // Limit to 8 tokens max
    
    for (let i = 0; i < tokenCount; i++) {
      const angle = (Math.PI * 2 * i) / tokenCount;
      const velocity = 2 + Math.random() * 3;
      const particle = {
        id: Math.random(),
        x: x,
        y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 1, // Slight upward bias
        color: color,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.01,
        size: 16 + Math.random() * 8, // Bigger size for emojis
        emoji: tokenEmojis[Math.floor(Math.random() * tokenEmojis.length)],
        isToken: true // Flag to render as emoji
      };
      newParticles.push(particle);
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const updateParticles = useCallback(() => {
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life - particle.decay,
        vy: particle.vy + 0.15,
        vx: particle.vx * 0.98
      }))
      .filter(particle => particle.life > 0)
    );
  }, []);

  const renderScreen = () => {
    switch (gameState.screen) {
      case 'start':
        return (
          <StartScreen
            bestScore={gameState.bestScore}
            onStartGame={startGame}
          />
        );
      case 'game':
        return (
          <GameScreen
            gameState={gameState}
            onEndGame={endGame}
            onUpdateScore={updateScore}
            onLoseLife={loseLife}
            onLoseLiveFromMissedToken={loseLiveFromMissedToken}
            onTogglePause={togglePause}
            onCreateParticles={handleCreateParticles}
            onCreateScreenFlash={createScreenFlash}
            updateParticles={updateParticles}
            onBackToHome={handleBackToLanding}
            aptos={aptos}
          />
        );
      case 'results':
        return (
          <ResultsScreen
            gameState={gameState}
            onStartGame={startGame}
            onShowStartScreen={handleBackToLanding}
            aptos={aptos}
          />
        );
      default:
        return null;
    }
  };

  const handleStartFromLanding = useCallback(() => {
    setShowLanding(false);
    startGame();
    // Start blockchain game session if wallet is connected
    if (aptos.isConnected) {
      aptos.startGameSession();
    }
  }, [startGame, aptos]);

  const handleBackToLanding = () => {
    showStartScreen(); // Reset game state to start screen
    setShowLanding(true);
  };

  if (showLanding) {
    return (
      <div className="App">
        {/* Beta Version Tag */}
        <div className="beta-tag">
          <span className="beta-text">BETA v0.1</span>
        </div>
        
        <LandingPage 
          onStartGame={handleStartFromLanding}
          aptos={aptos}
        />
      </div>
    );
  }

  return (
    <div className="App">
      
      {renderScreen()}
      <ParticleContainer particles={particles} />
      <SpeedInsights />
      <Analytics />
    </div>
  );
}

export default App;