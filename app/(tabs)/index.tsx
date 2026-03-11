import React, { useState, useEffect, useRef } from 'react';

// --- Assets & Constants ---
const HAZARD_TYPES = [
  { emoji: '🐝', msg: 'Poked a nest of wasps!' },
  { emoji: '🔌', msg: 'Used a fork in a toaster!' },
  { emoji: '🐻', msg: 'Bears are not your friends!' },
  { emoji: '🚂', msg: 'Stayed on the tracks too long!' },
  { emoji: '🧨', msg: 'Played with dynamite!' },
  { emoji: '🐍', msg: 'A snake is not a necktie!' }
];

const COLORS = {
  sky: '#7DD6F7',
  grass: '#97E376',
  hill: '#74C655',
  bean: '#4BA6E1',
  border: '#2C2C2C',
  accent: '#FF5A5F',
  warning: '#FFD600',
  track: '#8B4513'
};

export default function App() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [deathMsg, setDeathMsg] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Refs for High-Performance Loop
  const gameRef = useRef({
    score: 0,
    level: 1,
    bgOffset: 0,
    hazards: [] as any[],
    player: {
      x: 120,
      y: 0,
      width: 70,
      height: 100,
      dy: 0,
      jumpForce: 16,
      gravity: 0.7,
      isJumping: false,
      hairTimer: 0
    },
    groundY: 0,
    animationId: 0,
    lastSpawn: 0
  });

  const startGame = () => {
    gameRef.current.score = 0;
    gameRef.current.level = 1;
    gameRef.current.hazards = [];
    gameRef.current.player.dy = 0;
    gameRef.current.player.isJumping = false;
    setScore(0);
    setGameState('PLAYING');
  };

  const handleAction = () => {
    if (gameState === 'PLAYING' && !gameRef.current.player.isJumping) {
      gameRef.current.player.dy = -gameRef.current.player.jumpForce;
      gameRef.current.player.isJumping = true;
    } else if (gameState !== 'PLAYING') {
      startGame();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gameRef.current.groundY = canvas.height * 0.8;
      if (!gameRef.current.player.isJumping) {
        gameRef.current.player.y = gameRef.current.groundY - gameRef.current.player.height;
      }
    };

    window.addEventListener('resize', resize);
    resize();

    const drawBean = (ctx: CanvasRenderingContext2D, p: any) => {
      ctx.save();
      ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
      
      let stretch = 1;
      if (p.isJumping) stretch = 1.15 - Math.abs(p.dy / 35);

      // Body - Using RoundRect for the Pill Shape
      ctx.beginPath();
      const r = 35;
      const x = -p.width / 2;
      const y = -p.height / 2 * stretch;
      const w = p.width;
      const h = p.height * stretch;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      
      ctx.fillStyle = COLORS.bean;
      ctx.fill();
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 8;
      ctx.stroke();

      // Hair (Simple tufts)
      p.hairTimer += 0.15;
      ctx.fillStyle = '#FF9800';
      for(let i = -1; i <= 1; i++) {
        ctx.beginPath();
        const hX = i * 15;
        const hY = -p.height/2 * stretch;
        ctx.ellipse(hX, hY, 8, 20 + Math.sin(p.hairTimer + i) * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-15, -20, 5, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(15, -20, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.beginPath();
      ctx.ellipse(0, 5, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const update = () => {
      const g = gameRef.current;
      g.bgOffset += 7 + g.level;

      // Player Physics
      if (g.player.isJumping) {
        g.player.y += g.player.dy;
        g.player.dy += g.player.gravity;
        if (g.player.y >= g.groundY - g.player.height) {
          g.player.y = g.groundY - g.player.height;
          g.player.isJumping = false;
          g.player.dy = 0;
        }
      }

      // Hazard Spawning
      const now = Date.now();
      const spawnRate = Math.max(800, 2200 - (g.level * 150));
      if (now - g.lastSpawn > spawnRate) {
        const type = HAZARD_TYPES[Math.floor(Math.random() * HAZARD_TYPES.length)];
        g.hazards.push({
          x: canvas.width + 100,
          y: g.groundY - 60,
          width: 60,
          height: 60,
          speed: 8 + (g.level * 1.5),
          emoji: type.emoji,
          msg: type.msg
        });
        g.lastSpawn = now;
      }

      // Hazard Updates & Collision
      for (let i = g.hazards.length - 1; i >= 0; i--) {
        const h = g.hazards[i];
        h.x -= h.speed;

        // Collision Check (Shrunk hitbox for fairness)
        const p = g.player;
        const pad = 20;
        if (p.x + pad < h.x + h.width - pad &&
            p.x + p.width - pad > h.x + pad &&
            p.y + pad < h.y + h.height - pad &&
            p.y + p.height - pad > h.y + pad) {
          setDeathMsg(h.msg);
          setGameState('GAMEOVER');
        }

        if (h.x + h.width < 0) {
          g.hazards.splice(i, 1);
          g.score++;
          setScore(g.score);
          if (g.score % 5 === 0) g.level++;
        }
      }
    };

    const render = () => {
      const g = gameRef.current;
      
      // Sky
      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant Hills
      ctx.fillStyle = COLORS.hill;
      ctx.beginPath();
      ctx.moveTo(0, g.groundY);
      ctx.bezierCurveTo(canvas.width * 0.3, g.groundY - 200, canvas.width * 0.7, g.groundY - 250, canvas.width, g.groundY);
      ctx.fill();

      // Ground/Track
      ctx.fillStyle = '#E6D5AC';
      ctx.fillRect(0, g.groundY, canvas.width, canvas.height - g.groundY);
      
      // Rails/Ties
      ctx.fillStyle = COLORS.border;
      ctx.fillRect(0, g.groundY, canvas.width, 8);
      
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 6;
      for (let i = 0; i < canvas.width + 200; i += 150) {
        const xPos = i - (g.bgOffset % 150);
        ctx.beginPath();
        ctx.moveTo(xPos, g.groundY + 8);
        ctx.lineTo(xPos - 60, canvas.height);
        ctx.stroke();
      }

      // Draw Bean
      drawBean(ctx, g.player);

      // Draw Hazards & Warnings
      g.hazards.forEach(h => {
        // Emoji Hazard
        ctx.font = '60px serif';
        ctx.textAlign = 'center';
        ctx.fillText(h.emoji, h.x + h.width / 2, h.y + 45);

        // Warning UI (Visible when hazard is approaching)
        if (h.x > canvas.width - 100) {
          ctx.save();
          const pulse = 1 + Math.sin(Date.now() / 100) * 0.1;
          ctx.translate(canvas.width - 80, g.groundY - 60);
          ctx.scale(pulse, pulse);
          
          ctx.fillStyle = COLORS.warning;
          ctx.strokeStyle = COLORS.border;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, -25);
          ctx.lineTo(25, 20);
          ctx.lineTo(-25, 20);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          ctx.fillStyle = '#000';
          ctx.font = 'bold 24px Arial';
          ctx.fillText('!', 0, 10);
          ctx.restore();
        }
      });
    };

    const loop = () => {
      if (gameRef.current.animationId === -1) return;
      if (gameState === 'PLAYING') {
        update();
        render();
      } else {
        render(); // Keep rendering for background/start screen
      }
      gameRef.current.animationId = requestAnimationFrame(loop);
    };

    gameRef.current.animationId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(gameRef.current.animationId);
      gameRef.current.animationId = -1;
      window.removeEventListener('resize', resize);
    };
  }, [gameState]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden select-none touch-none"
      style={{ backgroundColor: COLORS.sky, fontFamily: 'sans-serif' }}
      onMouseDown={handleAction}
      onTouchStart={(e) => { e.preventDefault(); handleAction(); }}
    >
      {/* HUD */}
      {gameState === 'PLAYING' && (
        <div className="absolute top-10 left-0 w-full flex justify-center pointer-events-none z-10">
          <div 
            className="bg-white px-8 py-2 rounded-2xl border-4 border-zinc-800 text-3xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
          >
            {score}
          </div>
        </div>
      )}

      {/* Screens */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-sky-400/30 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center">
          <h1 className="text-8xl font-black text-white leading-[0.8] mb-4 drop-shadow-xl" 
              style={{ WebkitTextStroke: '12px #2C2C2C', paintOrder: 'stroke fill' }}>
            DUMB<br/>WAYS TO<br/>JUMP
          </h1>
          <p className="text-white text-xl font-bold uppercase tracking-widest mb-8"
             style={{ WebkitTextStroke: '4px #2C2C2C', paintOrder: 'stroke fill' }}>
            Stay Alive.
          </p>
          <button className="bg-blue-400 hover:scale-110 active:scale-95 transition-transform text-white text-4xl font-black px-12 py-4 rounded-full border-4 border-zinc-800 shadow-[0_8px_0_0_#2C2C2C] uppercase">
            PLAY
          </button>
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 bg-red-400/30 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-12 rounded-[50px] border-[10px] border-zinc-800 shadow-2xl max-w-md w-full">
            <h2 className="text-6xl font-black text-red-500 mb-2"
                style={{ WebkitTextStroke: '8px #2C2C2C', paintOrder: 'stroke fill' }}>
              SO DUMB
            </h2>
            <p className="text-2xl font-bold text-zinc-700 mb-6 italic">"{deathMsg}"</p>
            <div className="text-4xl font-black text-zinc-800 mb-8">
              SCORE: {score}
            </div>
            <button className="bg-red-500 hover:scale-105 active:scale-95 transition-transform text-white text-3xl font-black px-10 py-4 rounded-full border-4 border-zinc-800 shadow-[0_6px_0_0_#2C2C2C] uppercase w-full">
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}