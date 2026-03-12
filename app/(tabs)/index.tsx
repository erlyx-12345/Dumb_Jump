import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, SafeAreaView, StatusBar, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

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
  ground: '#74C655',
  player: '#4BA6E1',
  hazard: '#FF5A5F',
  text: '#1f2937'
};

const window = Dimensions.get('window');

export default function App() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [deathMsg, setDeathMsg] = useState('');
  const [playerY, setPlayerY] = useState(window.height * 0.65);
  const playerYRef = useRef(window.height * 0.65);
  const [playerDy, setPlayerDy] = useState(0);
  const playerDyRef = useRef(0);
  const [hazards, setHazards] = useState<{x:number; y:number; emoji:string; msg:string; passed?: boolean;}[]>([]);
  const [level, setLevel] = useState(1);
  const [groundY] = useState(window.height * 0.75);
  const nextSpawn = useRef(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const jumpSoundRef = useRef<Audio.Sound | null>(null);
  const gameoverSoundRef = useRef<Audio.Sound | null>(null);

  const resetGame = () => {
    setScore(0);
    setLevel(1);
    setHazards([]);
    setDeathMsg('');
    setGameState('PLAYING');
    playerYRef.current = groundY - 80;
    playerDyRef.current = 0;
    setPlayerY(groundY - 80);
    setPlayerDy(0);
    nextSpawn.current = Date.now();
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const saved = await AsyncStorage.getItem('@high_score');
        if (saved) setHighScore(Number(saved));

        const { sound: jumpSound } = await Audio.Sound.createAsync(require('../../assets/sounds/jump.mp3'));
        const { sound: gameoverSound } = await Audio.Sound.createAsync(require('../../assets/sounds/gameover.mp3'));
        jumpSoundRef.current = jumpSound;
        gameoverSoundRef.current = gameoverSound;
      } catch (error) {
        console.log('Audio or storage load error', error);
      }
    };
    loadConfig();
  }, []);

  const jump = async () => {
    if (gameState !== 'PLAYING') return;

    if (playerYRef.current >= groundY - 80) {
      playerDyRef.current = -16;
      setPlayerDy(-16);

      if (soundEnabled && jumpSoundRef.current) {
        jumpSoundRef.current.replayAsync().catch(e => console.log('Jump sound fail', e));
      }
      Haptics.selectionAsync();
    }
  };

  const startPlaying = () => {
    resetGame();
    setGameState('PLAYING');
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameState !== 'PLAYING') return;

      // Update player position and velocity confidentially using refs
      let newY = playerYRef.current + playerDyRef.current;
      let newDy = playerDyRef.current + 0.8;
      if (newY >= groundY - 80) {
        newY = groundY - 80;
        newDy = 0;
      }
      playerYRef.current = newY;
      playerDyRef.current = newDy;
      setPlayerY(newY);
      setPlayerDy(newDy);

      setHazards(old => {
        const now = Date.now();
        const speed = 6 + level * 0.65;
        const minSpawn = Math.max(500, 2200 - level * 130);
        let scoreGain = 0;

        const next = old
          .map(h => {
            const newX = h.x - speed;
            const wasPassed = h.x > 40 && newX <= 40;
            if (wasPassed) scoreGain += 1;
            return { ...h, x: newX, passed: h.passed || wasPassed };
          })
          .filter(h => h.x > -100);

        if (now - nextSpawn.current > minSpawn) {
          const type = HAZARD_TYPES[Math.floor(Math.random() * HAZARD_TYPES.length)];
          next.push({
            x: window.width + 40,
            y: groundY - 60,
            emoji: type.emoji,
            msg: type.msg,
            passed: false
          });
          nextSpawn.current = now;
        }

        const playerRect = { x: 40, y: playerYRef.current, w: 70, h: 80 };

        for (const h of next) {
          const hazardRect = { x: h.x, y: h.y, w: 50, h: 50 };
          const collision =
            playerRect.x < hazardRect.x + hazardRect.w &&
            playerRect.x + playerRect.w > hazardRect.x &&
            playerRect.y < hazardRect.y + hazardRect.h &&
            playerRect.y + playerRect.h > hazardRect.y;

          if (collision) {
            setGameState('GAMEOVER');
            setDeathMsg(h.msg);
            if (soundEnabled && gameoverSoundRef.current) {
              gameoverSoundRef.current.replayAsync().catch(e => console.log('Gameover sound fail', e));
            }

            if (score > highScore) {
              setHighScore(score);
              AsyncStorage.setItem('@high_score', String(score)).catch(console.log);
            }
            return next;
          }
        }

        if (scoreGain > 0) {
          setScore(prevScore => {
            const newScore = prevScore + scoreGain;
            if (newScore % 5 === 0) {
              setLevel(l => l + 1);
            }
            return newScore;
          });
        }

        return next;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [gameState, level, groundY, score, highScore, soundEnabled]);

  const gameContent = (
    <Pressable style={styles.gameArea} onPress={jump}>
      <View style={styles.sky}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.hudRow}>
          <View style={styles.hudLeft}>
            <Text style={styles.scoreBig}>{score}</Text>
            <Text style={styles.scoreSmall}>|</Text>
            <Text style={styles.highScoreIcon}>🏆 {highScore}</Text>
          </View>

          <View style={styles.hudRight}>
            <Text style={styles.levelBadge}>⚡ LVL {level}</Text>
            <Pressable
              style={styles.soundCircle}
              onPress={() => setSoundEnabled(enabled => !enabled)}
            >
              <Text style={styles.soundText}>{soundEnabled ? '🔊' : '🔇'}</Text>
            </Pressable>
          </View>
        </View>

        </SafeAreaView>

        {hazards.map((h, i) => (
          <Text key={`${h.emoji}-${i}`} style={[styles.hazard, { left: h.x, top: h.y }]}>{h.emoji}</Text>
        ))}

        <View style={[styles.ground, { top: groundY }]} />
        <View style={[styles.player, { top: playerY }]} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {gameState === 'START' ? (
        <View style={styles.mainMenu}>
          <View style={styles.menuCard}>
            <View style={styles.iconBox}>
              <Text style={styles.iconEmoji}>📦</Text>
            </View>
            <Text style={styles.mainTitle}>DUMB JUMP</Text>
            <Text style={styles.mainSubtitle}>Tap to survive. That's it.</Text>

            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>High Score</Text>
              <Text style={styles.scoreValue}>{highScore}</Text>
            </View>

            <Pressable style={styles.startButton} onPress={startPlaying}>
              <Text style={styles.startButtonText}>START JUMPING</Text>
            </Pressable>

            <Text style={styles.secondText}>Developed for maximum dumbness.</Text>
          </View>
        </View>
      ) : gameState === 'GAMEOVER' ? (
        <View style={[styles.mainMenu, styles.gameoverMenu]}>          
          <View style={styles.gameoverBadge}>
            <Text style={styles.skullIcon}>💀</Text>
          </View>
          <Text style={styles.gameoverTitle}>OOPS!</Text>
          <Text style={styles.gameoverSubtitle}>&quot;{deathMsg}&quot;</Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCardSmall}>
              <Text style={styles.scoreHeader}>SCORE</Text>
              <Text style={styles.scoreValueText}>{score}</Text>
            </View>
            <View style={styles.scoreCardSmall}>
              <Text style={styles.scoreHeader}>BEST</Text>
              <Text style={styles.scoreValueText}>{highScore}</Text>
            </View>
          </View>

          <Pressable style={styles.tryAgainButton} onPress={startPlaying}>
            <Text style={styles.tryAgainText}>TRY AGAIN</Text>
          </Pressable>

          <Text style={styles.secondText}>Developed for maximum dumbness</Text>
        </View>
      ) : (
        gameContent
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sky: {
    flex: 1,
    backgroundColor: COLORS.sky,
  },
  score: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
  highScore: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  soundButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  soundText: {
    fontSize: 18,
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 12,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 10,
    marginTop: Platform.OS === 'android' ? ((StatusBar.currentHeight ?? 0) + 6) : 6,
    borderRadius: 16,
    padding: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  cloudsContainer: {
    position: 'absolute',
    width: '100%',
    height: 240,
    top: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cloud: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 100,
    opacity: 0.95,
  },
  cloud1: {
    width: 190,
    height: 48,
    top: 20,
    left: 20,
  },
  cloud2: {
    width: 260,
    height: 60,
    top: 45,
    right: 25,
  },
  cloud3: {
    width: 210,
    height: 54,
    top: 80,
    left: 80,
  },
  gameArea: {
    flex: 1,
    width: '100%',
  },
  mainMenu: {
    flex: 1,
    backgroundColor: '#228CFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    paddingHorizontal: 20,
  },
  menuCard: {
    width: '92%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#2973FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 38,
  },
  mainTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0E1B3B',
    textAlign: 'center',
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5675A5',
    textAlign: 'center',
    marginBottom: 20,
  },
  mainText: {
    fontSize: 18,
    color: '#2F4E7F',
    textAlign: 'center',
    marginBottom: 14,
  },
  scoreCard: {
    width: '100%',
    backgroundColor: '#ECF4FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#456B9B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#163E8B',
  },
  startButton: {
    backgroundColor: '#16C25A',
    width: '100%',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
    shadowColor: '#0B6D27',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  secondText: {
    color: '#7B93B3',
    fontSize: 13,
    marginTop: 4,
  },
  gameoverMenu: {
    backgroundColor: '#F9F4F4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gameoverBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  skullIcon: {
    fontSize: 40,
  },
  gameoverTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 1,
    marginBottom: 4,
  },
  gameoverSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    fontStyle: 'italic',
    marginBottom: 18,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  scoreCardSmall: {
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreHeader: {
    fontSize: 14,
    letterSpacing: 1,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '700',
  },
  scoreValueText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
  },
  tryAgainButton: {
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 7,
  },
  tryAgainText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  info: {
    marginTop: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  level: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBig: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.text,
    marginRight: 6,
  },
  scoreSmall: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginRight: 6,
  },
  highScoreIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    marginRight: 8,
  },
  levelBadge: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1d4ed8',
    backgroundColor: '#bae6fd',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  soundCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#dbeafe',
    borderWidth: 1,
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 120,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  gameoverOverlay: {
    backgroundColor: 'rgba(255, 120, 120, 0.95)',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    color: COLORS.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 20,
  },
  deathMsg: {
    fontSize: 20,
    color: COLORS.text,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#117A32',
    height: 56,
    width: '85%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#D1FFCB',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: COLORS.ground,
  },
  player: {
    position: 'absolute',
    left: 40,
    width: 70,
    height: 80,
    borderRadius: 16,
    backgroundColor: COLORS.player,
    borderColor: '#2C2C2C',
    borderWidth: 3,
  },
  hazard: {
    position: 'absolute',
    fontSize: 42,
  },
});
