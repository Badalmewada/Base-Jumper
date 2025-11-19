import React, { useState, useEffect, useCallback, useRef } from 'react';


// --- Game Constants ---
const GROUND_HEIGHT = 20; // px
const DINO_SIZE = 40; // px
const DINO_START_X = 50; // px
const GAME_AREA_HEIGHT = 200; // px
const GAME_AREA_WIDTH = 600; // Define a fixed width for the viewport boundary
const INITIAL_GAME_SPEED = 5; // px per update
const GRAVITY = 0.5;
const JUMP_VELOCITY_START = 10;
const OBSTACLE_MIN_GAP = 300;
const OBSTACLE_MAX_GAP = 600;

// --- Helper Functions ---
const checkCollision = (dinoY, obstacle) => {
  // Dino rectangle coordinates (relative to the game area bottom)
  const dinoRect = {
    x: DINO_START_X,
    y: dinoY, // height from ground (0 when landed)
    width: DINO_SIZE,
    height: DINO_SIZE,
  };
  // Obstacle rectangle coordinates (relative to the game area bottom)
  const obsRect = {
    x: obstacle.x,
    y: 0, 
    width: obstacle.width,
    height: obstacle.height,
  };

  // Dino's Y position is the distance from the ground. We check for overlap.
  const dinoBottom = dinoRect.y; // Should be 0 when landed
  const dinoTop = dinoRect.y + dinoRect.height;
  const obsTop = obsRect.height; // Obstacle starts at y=0 (ground)

  // Check for intersection
  const xOverlap = dinoRect.x < obsRect.x + obsRect.width && dinoRect.x + dinoRect.width > obsRect.x;
  const yOverlap = dinoTop > obsRect.y && dinoBottom < obsTop;

  return xOverlap && yOverlap;
};

// --- Main App Component ---
const App = () => {
  // State Initialization
  const [dinoY, setDinoY] = useState(0); // Vertical offset from ground (0 = on ground)
  const [velocityY, setVelocityY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [isGameOver, setIsGameOver] = useState(true); // Starts on the title screen
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(INITIAL_GAME_SPEED);
  const [obstacles, setObstacles] = useState([]);
  const gameLoopRef = useRef();
  const [isPaused, setIsPaused] = useState(false);

  // --- BASE SDK READY CALL (This is the critical block in App.jsx) ---
  useEffect(() => {
    // We check if 'sdk' is available globally (thanks to the script tag)
    if (window.sdk && typeof window.sdk.actions.ready === 'function') {
        // This is the line that tells the Farcaster client to hide the splash screen.
        window.sdk.actions.ready(); 
    }
  }, []); // Runs only once after the component is rendered

  // Load high score from local storage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('dinoHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // Save high score whenever it updates
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('dinoHighScore', score);
    }
  }, [score, highScore]);

  // --- Event Handlers ---
  const handleJump = useCallback(() => {
    if (isGameOver || isPaused) {
      return; 
    }
    if (!isJumping && dinoY === 0) {
      setIsJumping(true);
      setVelocityY(JUMP_VELOCITY_START);
    }
  }, [isGameOver, isPaused, isJumping, dinoY]);

  const handleRestart = () => {
    setDinoY(0);
    setVelocityY(0);
    setIsJumping(false);
    setObstacles([]);
    setScore(0);
    setGameSpeed(INITIAL_GAME_SPEED);
    setIsGameOver(false); // Crucial: Start the game loop
  };

  // --- Game Physics and Logic (The Main Loop) ---
  const gameLoop = useCallback(() => {
    if (isGameOver || isPaused) {
      cancelAnimationFrame(gameLoopRef.current);
      return;
    }

    // 1. Update Score
    setScore(s => s + 1);

    // 2. Apply Gravity and Jumping
    setDinoY(currentY => {
      let newY = currentY + velocityY;
      let newVelocityY = velocityY;

      if (newY > 0) {
        newVelocityY -= GRAVITY; // Apply gravity
      } else {
        newY = 0;
        newVelocityY = 0;
        setIsJumping(false);
      }
      setVelocityY(newVelocityY);
      return newY;
    });

    // 3. Move, Update, and Check Collision for Obstacles
    setObstacles(currentObstacles => {
      let nextObstacles = [];
      let collisionDetected = false;

      currentObstacles.forEach(obs => {
        const newX = obs.x - gameSpeed;

        if (newX > -obs.width) {
          nextObstacles.push({ ...obs, x: newX });

          // Check for Collision
          if (!collisionDetected &&
              newX < DINO_START_X + DINO_SIZE &&
              newX + obs.width > DINO_START_X
          ) {
            if (checkCollision(dinoY, { ...obs, x: newX })) {
                collisionDetected = true;
            }
          }
        }
      });

      // Handle Game Over
      if (collisionDetected) {
        setIsGameOver(true);
        return currentObstacles; 
      }

      // 4. Generate New Obstacles 
      const lastObs = nextObstacles[nextObstacles.length - 1];

      if (!lastObs || lastObs.x < GAME_AREA_WIDTH - (lastObs.minGap + 50)) { // 50 is a buffer
        // Generate new obstacle
        const width = 15 + Math.random() * 20; 
        const height = 30 + Math.random() * 40; 
        const minGap = OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP); 

        nextObstacles.push({
          id: Date.now(),
          x: GAME_AREA_WIDTH, // Spawn off-screen right
          width: width,
          height: height,
          minGap: minGap,
        });
      }

      // 5. Increase Game Speed (every 500 score)
      if (score > 0 && score % 500 === 0) {
        setGameSpeed(s => Math.min(s + 0.5, 12)); // Cap speed at 12
      }

      return nextObstacles;
    });

    // Schedule next frame
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [isGameOver, isPaused, dinoY, velocityY, gameSpeed, score]);

  // Start the animation loop effect
  useEffect(() => {
    if (!isGameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      cancelAnimationFrame(gameLoopRef.current);
    };
  }, [isGameOver, gameLoop]);


  // Keyboard and Touch handler (Uses document events for broad coverage)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (isGameOver) {
          handleRestart();
        } else {
          handleJump();
        }
      }
    };

    // This handles taps that miss the GameArea's onClick handler
    const handleTouch = (e) => {
      // Prevent browser zoom/scrolling on touch
      if (e.target.closest('.relative.overflow-hidden')) {
          e.preventDefault();
          if (isGameOver) {
            handleRestart();
          } else {
            handleJump();
          }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouch);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleTouch);
    };
  }, [isGameOver, handleJump]);


  // --- Rendering Functions ---

  const Dino = () => (
    <div
      className={`absolute transition-colors duration-100 ${isGameOver ? 'bg-red-500' : 'bg-blue-600'} cursor-pointer`}
      style={{
        left: DINO_START_X,
        bottom: GROUND_HEIGHT + dinoY,
        width: DINO_SIZE,
        height: DINO_SIZE,
        borderRadius: '8%',
        boxShadow: isGameOver ? '0 0 15px rgba(255, 0, 0, 0.8)' : '0 0 10px rgba(5, 18, 255, 0.5)',
      }}
    >
      {/* Simple Eye */}
      {/* <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full">
        <div className="absolute w-1 h-1 bg-gray-900 rounded-full" style={{ top: '1px', left: '1px' }}></div>
      </div> */}
    </div>
  );

  const Obstacle = ({ x, width, height }) => (
    <div
      className="absolute bg-gray-700 rounded-lg shadow-xl"
      style={{
        left: x,
        bottom: GROUND_HEIGHT,
        width: width,
        height: height,
        transition: isGameOver ? 'none' : `transform 0.05s linear`,
        backgroundColor: '#6b7280', // Ensure visibility
      }}
    >
        {/* Simple Cactus Spikes */}
        <div className="absolute top-0 w-full h-2 bg-green-800 rounded-t-lg"></div>
    </div>
  );

  const GameArea = () => (
    <div
      className="relative overflow-hidden border-b-4 border-gray-800 bg-gray-100 mx-auto rounded-xl shadow-inner"
      style={{ height: GAME_AREA_HEIGHT, width: '100%', maxWidth: `${GAME_AREA_WIDTH}px` }}
      // CRITICAL LINE ADDED HERE: Handles taps and clicks within the game boundary
      onClick={isGameOver ? handleRestart : handleJump}
    >
      {/* Ground Line */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gray-400"
        style={{ height: GROUND_HEIGHT }}
      />
      
      {/* Dinosaur */}
      <Dino />

      {/* Obstacles */}
      {obstacles.map(obs => (
        <Obstacle
          key={obs.id}
          x={obs.x}
          width={obs.width}
          height={obs.height}
        />
      ))}

      {/* Game Over Message */}
      {isGameOver && score > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-30">
          <p className="text-4xl font-extrabold text-white mb-4">GAME OVER</p>
          <p className="text-xl text-yellow-300 mb-4">Score: {Math.floor(score / 10)}</p>
          <button
            onClick={handleRestart}
            className="px-6 py-3 bg-blue-500 text-white font-bold rounded-md shadow-lg hover:bg-blue-600 transition duration-150 transform hover:scale-105"
          >
            Press SPACE or Tap to Play
          </button>
        </div>
      )}

      {/* Initial Start Screen Message */}
      {isGameOver && score === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-20">
            <p className="text-3xl font-extrabold text-white mb-4">DINO RUN</p>
            <p className="text-xl text-white mb-6">Hit SPACE or TAP to start!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 p-4 flex flex-col items-center font-mono">
      <style>{`
        body {
          background-color: #e5e7eb;
        }
      `}</style>

      <div className="w-full max-w-xl bg-white p-6 rounded-2xl shadow-2xl space-y-4">
        <h1 className="text-3xl font-bold text-center text-gray-800">Base Jumper</h1>

        {/* Scoreboard */}
        <div className="flex justify-between items-center text-xl font-semibold text-gray-700">
          <p>Score: <span className="text-blue-600">{Math.floor(score / 10)}</span></p>
          <p>Hi-Score: <span className="text-red-600">{highScore > 0 ? Math.floor(highScore / 10) : 0}</span></p>
        </div>

        {/* Game Area */}
        <GameArea />
        {/* This button should replace the "Press SPACE or Tap..." hint text */}
<div className="flex justify-center mt-4">
    {isGameOver ? (
        <button
            onClick={handleRestart}
            className="w-full max-w-xs px-6 py-3 bg-green-600 text-white font-bold rounded-md shadow-lg hover:bg-blue-700 transition duration-150"
        >
            Start Game
        </button>
    ) : (
        <button
            // Toggle the isPaused state
            onClick={() => setIsPaused(p => !p)}
            className={`w-full max-w-xs px-6 py-3 font-bold rounded-md shadow-lg transition duration-150 ${
                isPaused 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
        >
            {isPaused ? 'Continue' : 'Stop'}
        </button>
    )}
</div>

        {/* Controls Hint */}
        {/* <p className="text-center text-sm text-gray-500 mt-4">
          Press <code className="bg-gray-200 px-1 rounded">SPACE</code> or tap anywhere on the game screen to jump.
        </p> */}
      </div>
    </div>
  );
};


export default App;