# Time-Based Game Type - Concept Document

## Overview

This document outlines the concept for a new game type: **Time-Based Reaction Game**. Unlike the current points-based games where evaluators manually enter scores, this game type measures team reaction time automatically.

---

## Game Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVALUATOR VIEW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Create game (type: time-based, max_time: 10.0s, max_points: 100)        │
│  2. Teams join via access codes (see team codes on screen)                  │
│  3. All teams connected → "START ROUND" button enabled                      │
│  4. Press START → Countdown syncs to all team pages                         │
│  5. View real-time results as teams press their buttons                     │
│  6. Round complete → scores calculated and saved automatically              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TEAM VIEW                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Enter 5-digit access code → Shows team name, waits for game start       │
│  2. Game starts → Countdown: 5... 4... 3... 2... 1...                       │
│  3. Countdown ends → BIG BUTTON appears                                      │
│  4. Team presses button → Time recorded, sent to server                     │
│  5. If timeout (didn't press) → Time = max_time + 0.1 (score = 0)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Game Types

```
Current (points-based):
- Evaluator enters raw scores manually
- Placement-based scoring (1st = 5pts, 2nd = 3pts, etc.)

New (time-based):
- Automatic time measurement
- Score = max_points - (elapsed_time * points_per_second)
- Faster reaction = higher score
```

### 2. Scoring Formula

```
max_time = 10.0 seconds (configurable)
max_points = 100 (configurable)
points_per_second = max_points / max_time = 10 points/second

Example:
- Team A presses at 2.3s → Score = 100 - (2.3 × 10) = 77 points
- Team B presses at 5.0s → Score = 100 - (5.0 × 10) = 50 points
- Team C timeout (10.0s) → Score = 0 points
```

---

## Technical Architecture

### A. Time Synchronization Strategy

**Problem**: Browser clocks are unreliable. We need sub-100ms precision for fair competition.

**Solution: Server-Authoritative Time with Offset Calculation**

```
┌──────────┐                           ┌──────────┐
│  Client  │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  1. Request: { clientTime: T1 }      │
     │─────────────────────────────────────>│
     │                                      │
     │  2. Response: {                      │
     │       serverTime: Ts,                │
     │       clientTime: T1                 │
     │     }                                │
     │<─────────────────────────────────────│
     │                                      │
     │  3. Client calculates:               │
     │     T2 = now()                       │
     │     RTT = T2 - T1                    │
     │     offset = Ts - T1 - (RTT/2)       │
     │                                      │
     │  4. Sync check (repeat 3x, avg)      │
     │                                      │
```

**Implementation:**
```javascript
// Client-side time sync
async function syncTime() {
  const samples = [];

  for (let i = 0; i < 3; i++) {
    const t1 = performance.now();
    const response = await fetch('/api/time-sync');
    const t2 = performance.now();
    const { serverTime } = await response.json();

    const rtt = t2 - t1;
    const offset = serverTime - t1 - (rtt / 2);
    samples.push({ offset, rtt });

    await sleep(100); // Small delay between samples
  }

  // Use sample with lowest RTT (most accurate)
  const bestSample = samples.sort((a, b) => a.rtt - b.rtt)[0];
  return bestSample.offset;
}

// Get server-equivalent time
function getServerTime(offset) {
  return performance.now() + offset;
}
```

**Why this works:**
- Uses `performance.now()` for high-resolution timing (0.1ms precision)
- Calculates network latency (RTT) and compensates
- Multiple samples, uses best one
- All timing events are server-authoritative

---

### B. Real-Time Communication (WebSocket)

**Current**: Polling every 10 seconds (not suitable for time-based games)

**Required**: WebSocket for real-time events

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WebSocket Events                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Server → Client:                                                    │
│  ─────────────────                                                   │
│  • team:validated      - Code accepted, show team name               │
│  • team:rejected       - Code invalid/already used                   │
│  • game:countdown      - Start countdown { startsAt: serverTime }    │
│  • game:go             - Show button { goTime: serverTime }          │
│  • game:timeout        - Time's up, button disabled                  │
│  • game:results        - Round complete { results: [...] }           │
│  • team:kicked         - Code was reset, disconnect                  │
│                                                                      │
│  Client → Server:                                                    │
│  ─────────────────                                                   │
│  • team:join           - { code: "12345" }                           │
│  • team:press          - { pressTime: serverTime, clientTime: x }    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Socket.io Room Structure:**
```
game:{gameId}           - All clients for a game
  ├── evaluator:{odId}  - Evaluator(s) watching
  └── team:{teamId}     - Team's active connection
```

---

### C. Team Access Codes

**Requirements:**
1. 5-digit random code (e.g., "48291")
2. One-time use per game round
3. Only one active session per code
4. Moderator can reset/regenerate

**Database Schema Addition:**
```sql
CREATE TABLE team_access_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  team_id INT NOT NULL,
  code VARCHAR(5) NOT NULL,
  status ENUM('available', 'active', 'used', 'disabled') DEFAULT 'available',
  socket_id VARCHAR(100) NULL,          -- Active WebSocket connection
  connected_at TIMESTAMP NULL,
  pressed_at TIMESTAMP NULL,
  reaction_time_ms INT NULL,            -- Milliseconds (stored as int)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE KEY unique_game_code (game_id, code),
  UNIQUE KEY unique_game_team (game_id, team_id)
);
```

**Code Lifecycle:**
```
┌───────────┐     Team enters      ┌───────────┐    WebSocket    ┌───────────┐
│ available │ ──────code─────────> │  active   │ ───disconnect──>│   used    │
└───────────┘                      └───────────┘                 └───────────┘
      │                                  │                             │
      │        Admin resets              │      Same code from        │
      │<─────────────────────────────────┼──────another device────────│
      │                                  │           │                 │
      │                                  ▼           │                 │
      │                           ┌───────────┐     │                 │
      │                           │  REJECT   │<────┘                 │
      │                           └───────────┘                       │
      │                                                               │
      │                     Admin disables                            │
      └──────────────────────────────────────────────────────────────>│
                                                               ┌──────────┐
                                                               │ disabled │
                                                               └──────────┘
```

**Security Features:**
```javascript
// Joining with a code
async function handleTeamJoin(socket, { code, gameId }) {
  const accessCode = await db.query(`
    SELECT * FROM team_access_codes
    WHERE game_id = ? AND code = ? AND status = 'available'
  `, [gameId, code]);

  if (!accessCode) {
    socket.emit('team:rejected', {
      reason: 'Invalid code or already in use'
    });
    return;
  }

  // Lock the code to this socket
  await db.query(`
    UPDATE team_access_codes
    SET status = 'active', socket_id = ?, connected_at = NOW()
    WHERE id = ?
  `, [socket.id, accessCode.id]);

  socket.accessCodeId = accessCode.id;
  socket.teamId = accessCode.team_id;
  socket.join(`game:${gameId}`);

  socket.emit('team:validated', {
    teamName: accessCode.team_name,
    gameId
  });

  // Notify evaluator
  io.to(`evaluator:${gameId}`).emit('team:connected', {
    teamId: accessCode.team_id,
    teamName: accessCode.team_name
  });
}

// Handle disconnect - mark as used
socket.on('disconnect', async () => {
  if (socket.accessCodeId) {
    await db.query(`
      UPDATE team_access_codes SET status = 'used' WHERE id = ?
    `, [socket.accessCodeId]);
  }
});

// Admin reset code
async function resetTeamCode(gameId, teamId) {
  // Disable old code
  const old = await db.query(`
    SELECT socket_id FROM team_access_codes
    WHERE game_id = ? AND team_id = ?
  `, [gameId, teamId]);

  if (old && old.socket_id) {
    // Kick existing connection
    io.to(old.socket_id).emit('team:kicked', {
      reason: 'Code was reset by moderator'
    });
    io.sockets.sockets.get(old.socket_id)?.disconnect(true);
  }

  // Generate new code
  const newCode = generateCode(); // Random 5 digits
  await db.query(`
    UPDATE team_access_codes
    SET code = ?, status = 'available', socket_id = NULL
    WHERE game_id = ? AND team_id = ?
  `, [newCode, gameId, teamId]);

  return newCode;
}
```

---

### D. Game Round Flow

**Evaluator Starts Round:**
```javascript
async function startRound(gameId) {
  // 1. Check all teams connected
  const teams = await db.query(`
    SELECT * FROM team_access_codes
    WHERE game_id = ? AND status = 'active'
  `, [gameId]);

  // 2. Calculate synchronized start time
  const now = Date.now();
  const countdownDuration = 5000; // 5 seconds
  const startsAt = now + countdownDuration;

  // 3. Reset team press times
  await db.query(`
    UPDATE team_access_codes
    SET pressed_at = NULL, reaction_time_ms = NULL
    WHERE game_id = ?
  `, [gameId]);

  // 4. Broadcast countdown to all clients
  io.to(`game:${gameId}`).emit('game:countdown', {
    startsAt,          // Server timestamp when button appears
    maxTime: 10000,    // Max reaction time in ms
    serverTime: now    // Current server time for offset calculation
  });

  // 5. Schedule "GO" event
  setTimeout(() => {
    io.to(`game:${gameId}`).emit('game:go', {
      goTime: Date.now(),
      maxTime: 10000
    });
  }, countdownDuration);

  // 6. Schedule timeout
  setTimeout(() => {
    endRound(gameId);
  }, countdownDuration + 10000);
}
```

**Team Presses Button:**
```javascript
socket.on('team:press', async ({ pressTime }) => {
  const gameId = socket.gameId;
  const teamId = socket.teamId;

  // Get game start time
  const game = await getGameState(gameId);
  if (!game.goTime) return; // Game not started

  // Calculate reaction time (server-authoritative)
  // Use the server's received time, not client's claimed time
  const serverReceiveTime = Date.now();
  const networkLatency = estimateLatency(socket); // From ping/pong
  const estimatedPressTime = serverReceiveTime - (networkLatency / 2);

  const reactionTimeMs = Math.max(0, estimatedPressTime - game.goTime);

  // Validate: not negative, not after timeout
  if (reactionTimeMs > game.maxTime) {
    reactionTimeMs = game.maxTime + 100; // Timeout penalty
  }

  // Store result
  await db.query(`
    UPDATE team_access_codes
    SET pressed_at = NOW(), reaction_time_ms = ?
    WHERE game_id = ? AND team_id = ?
  `, [reactionTimeMs, gameId, teamId]);

  // Notify evaluator
  io.to(`evaluator:${gameId}`).emit('team:pressed', {
    teamId,
    reactionTimeMs,
    displayTime: (reactionTimeMs / 1000).toFixed(1) // "2.3"
  });

  // Acknowledge to team
  socket.emit('press:confirmed', {
    reactionTimeMs,
    displayTime: (reactionTimeMs / 1000).toFixed(1)
  });
});
```

**Round Ends:**
```javascript
async function endRound(gameId) {
  const game = await db.query(`SELECT * FROM games WHERE id = ?`, [gameId]);

  // Get all results
  const results = await db.query(`
    SELECT tac.*, t.name as team_name
    FROM team_access_codes tac
    JOIN teams t ON t.id = tac.team_id
    WHERE tac.game_id = ?
  `, [gameId]);

  const maxTime = game.max_time_ms;
  const maxPoints = game.maximum_point;
  const pointsPerMs = maxPoints / maxTime;

  const scoredResults = results.map(r => {
    let reactionMs = r.reaction_time_ms;
    let score = 0;

    if (reactionMs === null) {
      // Didn't press - timeout
      reactionMs = maxTime + 100;
      score = 0;
    } else if (reactionMs <= maxTime) {
      // Valid press
      score = Math.round(maxPoints - (reactionMs * pointsPerMs));
    }
    // else: pressed after timeout, score = 0

    return {
      teamId: r.team_id,
      teamName: r.team_name,
      reactionTimeMs: reactionMs,
      displayTime: (reactionMs / 1000).toFixed(1),
      score,
      timedOut: reactionMs > maxTime
    };
  });

  // Sort by reaction time (fastest first)
  scoredResults.sort((a, b) => a.reactionTimeMs - b.reactionTimeMs);

  // Save scores to game_scores table
  for (const result of scoredResults) {
    await db.query(`
      INSERT INTO game_scores (game_id, team_id, score)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE score = ?
    `, [gameId, result.teamId, result.score, result.score]);
  }

  // Recalculate group scores
  await calculateGroupScores(game.gaming_group_id);

  // Broadcast results
  io.to(`game:${gameId}`).emit('game:results', { results: scoredResults });
}
```

---

## Database Changes

### Modified Tables

```sql
-- Add game_type to games table
ALTER TABLE games
ADD COLUMN game_type ENUM('points', 'time') DEFAULT 'points' AFTER status,
ADD COLUMN max_time_ms INT DEFAULT 10000 AFTER game_type;

-- Note: max_time_ms only used when game_type = 'time'
-- For time games: maximum_point is the max score (e.g., 100)
```

### New Table

```sql
CREATE TABLE team_access_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  team_id INT NOT NULL,
  code VARCHAR(5) NOT NULL,
  status ENUM('available', 'active', 'used', 'disabled') DEFAULT 'available',
  socket_id VARCHAR(100) NULL,
  connected_at TIMESTAMP NULL,
  pressed_at TIMESTAMP NULL,
  reaction_time_ms INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE KEY unique_game_code (game_id, code),
  UNIQUE KEY unique_game_team (game_id, team_id)
);
```

---

## UI/UX Concepts

### Team Page (`/play/:code` or `/play?code=12345`)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │                    ENTER ACCESS CODE                    │   │
│  │                                                         │   │
│  │              ┌───┬───┬───┬───┬───┐                      │   │
│  │              │ 4 │ 8 │ 2 │ 9 │ 1 │                      │   │
│  │              └───┴───┴───┴───┴───┘                      │   │
│  │                                                         │   │
│  │                    [ JOIN GAME ]                        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

        After code validated:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                         TEAM: BLUE DRAGONS                      │
│                                                                 │
│                    Waiting for game to start...                 │
│                                                                 │
│                            ◉ Connected                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

        Countdown phase:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                              3                                  │
│                         (huge number)                           │
│                                                                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

        GO phase:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│            ┌─────────────────────────────────────┐             │
│            │                                     │             │
│            │                                     │             │
│            │                                     │             │
│            │            PRESS NOW!               │             │
│            │                                     │             │
│            │                                     │             │
│            │                                     │             │
│            └─────────────────────────────────────┘             │
│                                                                 │
│                          ⏱️ 2.3s                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

        After press:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                        YOUR TIME: 2.3s                          │
│                                                                 │
│                        SCORE: 77 points                         │
│                                                                 │
│                    Waiting for other teams...                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Evaluator View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Time-Based Game: Quick Reaction Challenge                      [RUNNING]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Settings: Max Time: 10.0s | Max Points: 100                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ TEAM ACCESS CODES                                                      │ │
│  ├──────────────┬─────────┬───────────┬─────────────────────────────────┐ │
│  │ Team         │ Code    │ Status    │ Actions                         │ │
│  ├──────────────┼─────────┼───────────┼─────────────────────────────────┤ │
│  │ Blue Dragons │ 48291   │ ● Active  │ [Reset Code] [Kick]             │ │
│  │ Red Phoenix  │ 73625   │ ○ Waiting │ [Reset Code]                    │ │
│  │ Green Ninjas │ 19847   │ ● Active  │ [Reset Code] [Kick]             │ │
│  │ Yellow Stars │ 56230   │ ✗ Used    │ [Generate New]                  │ │
│  └──────────────┴─────────┴───────────┴─────────────────────────────────┘ │
│                                                                             │
│                   [ START ROUND ]  (3 of 4 teams ready)                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ROUND RESULTS                                                              │
│  ┌──────────────┬───────────┬─────────┬────────────────────────────────┐   │
│  │ Rank         │ Team      │ Time    │ Score                          │   │
│  ├──────────────┼───────────┼─────────┼────────────────────────────────┤   │
│  │ 🥇 1st       │ Blue Dragons│ 1.2s   │ 88 pts                        │   │
│  │ 🥈 2nd       │ Green Ninjas│ 2.4s   │ 76 pts                        │   │
│  │ 🥉 3rd       │ Red Phoenix │ 4.8s   │ 52 pts                        │   │
│  │    4th       │ Yellow Stars│ TIMEOUT │ 0 pts                        │   │
│  └──────────────┴───────────┴─────────┴────────────────────────────────┘   │
│                                                                             │
│                        [ SAVE SCORES ] [ NEW ROUND ]                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Backend WebSocket Infrastructure
- [ ] Add Socket.io to backend
- [ ] Create WebSocket authentication (JWT or code-based)
- [ ] Implement time-sync endpoint
- [ ] Create team access code table and APIs

### Phase 2: Team Access System
- [ ] Code generation API
- [ ] Code validation and locking
- [ ] Session management (one connection per code)
- [ ] Admin reset/regenerate functionality

### Phase 3: Game Type Extension
- [ ] Add `game_type` column to games
- [ ] Modify game creation form
- [ ] Create time-based game evaluation page

### Phase 4: Team Play Interface
- [ ] Create `/play` route and page
- [ ] Implement code entry UI
- [ ] WebSocket connection from Vue
- [ ] Countdown display
- [ ] Button press and timing

### Phase 5: Real-Time Game Flow
- [ ] Evaluator start round
- [ ] Synchronized countdown
- [ ] Button press handling
- [ ] Timeout detection
- [ ] Results calculation and display

### Phase 6: Score Integration
- [ ] Save time-based scores to game_scores
- [ ] Integrate with existing leaderboard
- [ ] Dashboard updates

---

## Open Questions

1. **Multiple Rounds**: Should time-based games support multiple rounds? (e.g., best of 3)
   - Could average scores across rounds
   - Or use cumulative scoring

2. **Fairness Considerations**:
   - Should we add random delay before showing button? (prevent anticipation)
   - Network latency compensation - how aggressive?

3. **Mobile Optimization**:
   - Large touch targets for button
   - Prevent accidental double-press
   - Handle screen lock/background

4. **Offline Handling**:
   - What if team disconnects mid-game?
   - Reconnection within timeout period?

5. **Code Distribution**:
   - QR codes for easy mobile access?
   - Display codes on projector for teams to scan?

---

## Technology Additions

```json
// Backend package.json additions
{
  "socket.io": "^4.7.x"
}

// Frontend package.json additions
{
  "socket.io-client": "^4.7.x"
}
```

---

## Security Considerations

1. **Rate Limiting**: Prevent code brute-forcing
2. **Code Entropy**: 5 digits = 100,000 combinations (sufficient for single event)
3. **Session Binding**: Code tied to WebSocket session ID
4. **Time Validation**: Server-authoritative timing, never trust client
5. **Replay Prevention**: Each press recorded with timestamp, can't re-submit

---

## Summary

This concept introduces a **time-based reaction game** that:

- Uses WebSocket for real-time communication
- Implements server-authoritative timing for fairness
- Provides secure one-time access codes for teams
- Integrates with existing scoring and leaderboard system
- Maintains the current admin/evaluator workflow

The key differentiator from the current system is **automatic scoring based on reaction time** rather than manual score entry.
