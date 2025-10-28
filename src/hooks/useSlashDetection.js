import { useState, useCallback, useRef } from 'react';

export const useSlashDetection = (
  canvasRef, 
  items, 
  gameState, 
  onUpdateScore, 
  onLoseLife, 
  onCreateParticles, 
  onCreateScreenFlash,
  addTrailPoint,
  isSlashing,
  addPopup,
  onSlashRecorded // Optional callback for blockchain recording
) => {
  const [slashPath, setSlashPath] = useState([]);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const slashVelocity = useRef({ vx: 0, vy: 0 });
  const slashedItems = useRef(new Set());

  const getMousePos = useCallback((e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, [canvasRef]);

  const createSliceEffect = useCallback((item, angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    for (let i = 0; i < 2; i++) {
      const half = document.createElement('div');
      half.className = 'slice-half';
      half.style.position = 'fixed';
      half.style.left = (rect.left + item.x - 20) + 'px';
      half.style.top = (rect.top + item.y - 20) + 'px';
      half.style.width = '40px';
      half.style.height = '40px';
      half.style.background = item.type.color;
      half.style.borderRadius = '50%';
      half.style.pointerEvents = 'none';
      half.style.zIndex = '999';
      half.style.fontSize = '24px';
      half.style.display = 'flex';
      half.style.alignItems = 'center';
      half.style.justifyContent = 'center';
      half.textContent = item.type.symbol;
      
      const direction = i === 0 ? 1 : -1;
      const perpAngle = angle + Math.PI / 2;
      const vx = Math.cos(perpAngle) * direction * 100;
      const vy = Math.sin(perpAngle) * direction * 100 - 50;
      
      half.style.transform = 'rotate(' + angle + 'rad)';
      half.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.8s ease-out';
      
      document.body.appendChild(half);
      
      requestAnimationFrame(() => {
        half.style.transform = 'translate(' + vx + 'px, ' + vy + 'px) rotate(' + (angle + direction * Math.PI) + 'rad) scale(0.3)';
        half.style.opacity = '0';
      });
      
      setTimeout(() => {
        if (document.body.contains(half)) {
          document.body.removeChild(half);
        }
      }, 800);
    }
  }, [canvasRef]);

  const createExplosionEffect = useCallback((item) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const explosion = document.createElement('div');
    explosion.className = 'bomb-explosion';
    explosion.style.position = 'fixed';
    explosion.style.left = (rect.left + item.x - 50) + 'px';
    explosion.style.top = (rect.top + item.y - 50) + 'px';
    explosion.style.width = '100px';
    explosion.style.height = '100px';
    explosion.style.background = 'radial-gradient(circle, #ff4444, #ff8888, transparent)';
    explosion.style.borderRadius = '50%';
    explosion.style.pointerEvents = 'none';
    explosion.style.zIndex = '999';
    explosion.style.animation = 'explode 0.6s ease-out forwards';
    
    document.body.appendChild(explosion);
    
    setTimeout(() => {
      if (document.body.contains(explosion)) {
        document.body.removeChild(explosion);
      }
    }, 600);
  }, [canvasRef]);

  const checkSlashCollisions = useCallback((currentPos, velocity) => {
    if (!isSlashing || velocity.speed < 2) return; // Lower speed threshold for easier slashing
    
    items.forEach((item) => {
      if (item.slashed || slashedItems.current.has(item.id)) return;
      
      const dx = currentPos.x - item.x;
      const dy = currentPos.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Use larger hit detection area for better gameplay
      const hitRadius = item.hitBox || item.radius + 20; // Use hitBox if available, otherwise radius + 20
      
      if (distance < hitRadius) {
        item.slashed = true;
        slashedItems.current.add(item.id);
        
        const canvas = canvasRef.current;
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        const popupX = rect.left + item.x;
        const popupY = rect.top + item.y;
        
        if (item.type.isGood) {
          // RULE: Fruit sliced → gain points (no heart lost)
          console.log('🍊 FRUIT SLICED! +' + item.type.points + ' points');
          
          // Create combo popup callback
          const handleComboPopup = (combo, bonusPoints) => {
            if (addPopup) {
              // Create combo popup slightly offset from regular popup
              setTimeout(() => {
                addPopup(popupX + 30, popupY - 20, bonusPoints, 'combo', combo);
              }, 200);
            }
          };
          
          onUpdateScore(item.type.points, handleComboPopup);
          onCreateParticles(item.x, item.y, '#00ff88', 15);
          
          if (addPopup) {
            addPopup(popupX, popupY, item.type.points, 'token');
          }
          
          const angle = Math.atan2(velocity.vy, velocity.vx);
          createSliceEffect(item, angle);
          
          // Record slash on blockchain if callback provided
          if (onSlashRecorded) {
            onSlashRecorded({
              isToken: true,
              x: item.x,
              y: item.y,
              points: item.type.points,
              combo: gameState.combo || 0
            });
          }
        } else {
          // RULE: Bomb sliced → penalty, lose 1 heart
          console.log('💣 BOMB SLICED! Penalty - losing 1 heart!');
          onLoseLife();
          onCreateParticles(item.x, item.y, '#ff4444', 25);
          onCreateScreenFlash();
          
          if (addPopup) {
            addPopup(popupX, popupY, 1, 'bomb');
          }
          
          createExplosionEffect(item);
          
          // Record bomb slash on blockchain if callback provided
          if (onSlashRecorded) {
            onSlashRecorded({
              isToken: false,
              x: item.x,
              y: item.y,
              points: 0,
              combo: gameState.combo || 0
            });
          }
        }
      }
    });
  }, [items, isSlashing, onUpdateScore, onLoseLife, onCreateParticles, onCreateScreenFlash, addPopup, canvasRef, createSliceEffect, createExplosionEffect, onSlashRecorded, gameState.combo]);

  const startSlash = useCallback((e) => {
    if (gameState.screen !== 'game' || !gameState.isGameRunning || gameState.isPaused) return;
    
    const pos = getMousePos(e);
    lastMousePos.current = pos;
    slashVelocity.current = { vx: 0, vy: 0, speed: 0 };
    slashedItems.current.clear();
    
    addTrailPoint(pos.x, pos.y);
    setSlashPath([pos]);
  }, [gameState.screen, gameState.isGameRunning, gameState.isPaused, getMousePos, addTrailPoint]);

  const updateSlash = useCallback((e) => {
    if (!isSlashing || gameState.screen !== 'game' || !gameState.isGameRunning || gameState.isPaused) return;
    
    const currentPos = getMousePos(e);
    const lastPos = lastMousePos.current;
    
    const vx = currentPos.x - lastPos.x;
    const vy = currentPos.y - lastPos.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    slashVelocity.current = { vx, vy, speed };
    
    // Check collisions along the entire slash line (not just current point)
    if (speed > 1) { // Lower threshold for better detection
      const steps = Math.max(5, Math.floor(speed / 2)); // More steps for better coverage
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const interpX = lastPos.x + (currentPos.x - lastPos.x) * t;
        const interpY = lastPos.y + (currentPos.y - lastPos.y) * t;
        
        checkSlashCollisions({ x: interpX, y: interpY }, slashVelocity.current);
      }
    }
    
    addTrailPoint(currentPos.x, currentPos.y);
    setSlashPath(prev => [...prev, currentPos]);
    
    checkSlashCollisions(currentPos, slashVelocity.current);
    lastMousePos.current = currentPos;
  }, [isSlashing, gameState.screen, gameState.isGameRunning, gameState.isPaused, getMousePos, addTrailPoint, checkSlashCollisions]);

  const endSlash = useCallback(() => {
    if (!isSlashing) return;
    
    setTimeout(() => {
      setSlashPath([]);
      slashedItems.current.clear();
    }, 100);
  }, [isSlashing]);

  return {
    startSlash,
    updateSlash,
    endSlash,
    slashPath
  };
};
