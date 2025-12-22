// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory state for active time-based games
const activeGames = new Map(); // gameId -> { status, goTime, round, results, ... }

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('ERROR: Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please create a .env file in the backend directory with the required variables.');
  console.error('See .env.example for reference.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '2h'; // Token expires in 2 hours

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Fix MySQL authentication method on startup (for MariaDB client compatibility)
async function fixMySQLAuthentication() {
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;

  try {
    // Try to alter the user to use mysql_native_password
    await pool.query(
      `ALTER USER ?@'%' IDENTIFIED WITH mysql_native_password BY ?`,
      [dbUser, dbPassword]
    );
    console.log('✓ MySQL authentication method fixed for MariaDB compatibility');
  } catch (error) {
    // Ignore errors - user might already be configured or we don't have permission
    if (error.code !== 'ER_CANNOT_USER') {
      console.log('Note: Could not alter MySQL authentication (this is normal if already configured)');
    }
  }
}

// Call authentication fix on startup
fixMySQLAuthentication().catch(err => {
  console.log('MySQL authentication check skipped:', err.message);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'Database connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== AUTHENTICATION MIDDLEWARE ====================

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to require administrator role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Administrator access required' });
  }
  next();
};

// ==================== SETUP ENDPOINTS ====================

// Check if setup is complete
app.get('/setup/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_setup_complete FROM setup_status ORDER BY id DESC LIMIT 1');

    if (rows.length === 0) {
      // If no record exists, setup is not complete
      return res.json({ isSetupComplete: false });
    }

    res.json({ isSetupComplete: rows[0].is_setup_complete });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ message: 'Failed to check setup status' });
  }
});

// Complete first-time setup (create admin user)
app.post('/setup/complete', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if setup is already complete
    const [setupStatus] = await connection.query(
      'SELECT is_setup_complete FROM setup_status ORDER BY id DESC LIMIT 1'
    );

    if (setupStatus.length > 0 && setupStatus[0].is_setup_complete) {
      await connection.rollback();
      return res.status(403).json({ message: 'Setup has already been completed' });
    }

    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      await connection.rollback();
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      await connection.rollback();
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'administrator']
    );

    // Mark setup as complete
    await connection.query(
      'UPDATE setup_status SET is_setup_complete = TRUE, setup_completed_at = NOW() ORDER BY id DESC LIMIT 1'
    );

    await connection.commit();

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email, role: 'administrator' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Setup completed successfully',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: 'administrator'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error completing setup:', error);
    res.status(500).json({ message: 'Failed to complete setup' });
  } finally {
    connection.release();
  }
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// Register a new user
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Validate role
    const validRoles = ['administrator', 'evaluator'];
    const userRole = role || 'evaluator';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ message: 'Invalid role. Must be administrator or evaluator' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, userRole]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email, role: userRole },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: userRole
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

// Login user
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token (expires in 2 hours)
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Failed to login' });
  }
});

// Get current user info (protected route)
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user information' });
  }
});

// ==================== COACHES ENDPOINTS ====================

// Get all coaches
app.get('/coaches', async (req, res) => {
  try {
    const [coaches] = await pool.query('SELECT * FROM coaches');

    // Get areas for each coach
    const coachesWithAreas = await Promise.all(
      coaches.map(async (coach) => {
        const [areas] = await pool.query(
          'SELECT area FROM coach_areas WHERE coach_id = ?',
          [coach.id]
        );
        return {
          id: coach.id,
          firstName: coach.first_name,
          lastName: coach.last_name,
          description: coach.description,
          hourlyRate: parseFloat(coach.hourly_rate),
          areas: areas.map(a => a.area)
        };
      })
    );

    res.json(coachesWithAreas);
  } catch (error) {
    console.error('Error fetching coaches:', error);
    res.status(500).json({ message: 'Failed to fetch coaches' });
  }
});

// Get a specific coach
app.get('/coaches/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [coaches] = await pool.query('SELECT * FROM coaches WHERE id = ?', [id]);

    if (coaches.length === 0) {
      return res.status(404).json({ message: 'Coach not found' });
    }

    const coach = coaches[0];
    const [areas] = await pool.query(
      'SELECT area FROM coach_areas WHERE coach_id = ?',
      [id]
    );

    res.json({
      id: coach.id,
      firstName: coach.first_name,
      lastName: coach.last_name,
      description: coach.description,
      hourlyRate: parseFloat(coach.hourly_rate),
      areas: areas.map(a => a.area)
    });
  } catch (error) {
    console.error('Error fetching coach:', error);
    res.status(500).json({ message: 'Failed to fetch coach' });
  }
});

// Register or update a coach
app.put('/coaches/:id', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { firstName, lastName, description, hourlyRate, areas } = req.body;

    // Check if coach exists
    const [existingCoach] = await connection.query(
      'SELECT id FROM coaches WHERE id = ?',
      [id]
    );

    if (existingCoach.length > 0) {
      // Update existing coach
      await connection.query(
        'UPDATE coaches SET first_name = ?, last_name = ?, description = ?, hourly_rate = ? WHERE id = ?',
        [firstName, lastName, description, hourlyRate, id]
      );
    } else {
      // Insert new coach
      await connection.query(
        'INSERT INTO coaches (id, first_name, last_name, description, hourly_rate) VALUES (?, ?, ?, ?, ?)',
        [id, firstName, lastName, description, hourlyRate]
      );
    }

    // Delete existing areas
    await connection.query('DELETE FROM coach_areas WHERE coach_id = ?', [id]);

    // Insert new areas
    if (areas && areas.length > 0) {
      const areaValues = areas.map(area => [id, area]);
      await connection.query(
        'INSERT INTO coach_areas (coach_id, area) VALUES ?',
        [areaValues]
      );
    }

    await connection.commit();

    res.json({
      id,
      firstName,
      lastName,
      description,
      hourlyRate: parseFloat(hourlyRate),
      areas
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error registering coach:', error);
    res.status(500).json({ message: 'Failed to register coach' });
  } finally {
    connection.release();
  }
});

// ==================== REQUESTS ENDPOINTS ====================

// Get all requests for a specific coach
app.get('/requests/:coachId', async (req, res) => {
  try {
    const { coachId } = req.params;

    const [requests] = await pool.query(
      'SELECT id, coach_id as coachId, user_email as userEmail, message, created_at as createdAt FROM requests WHERE coach_id = ? ORDER BY created_at DESC',
      [coachId]
    );

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// Create a new request
app.post('/requests/:coachId', async (req, res) => {
  try {
    const { coachId } = req.params;
    const { userEmail, message } = req.body;

    // Verify coach exists
    const [coaches] = await pool.query('SELECT id FROM coaches WHERE id = ?', [coachId]);

    if (coaches.length === 0) {
      return res.status(404).json({ message: 'Coach not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO requests (coach_id, user_email, message) VALUES (?, ?, ?)',
      [coachId, userEmail, message]
    );

    res.status(201).json({
      id: result.insertId,
      coachId,
      userEmail,
      message
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Failed to create request' });
  }
});

// ==================== GAMING GROUPS ENDPOINTS ====================

// Get all gaming groups
app.get('/gaming-groups', authenticateToken, async (req, res) => {
  try {
    const [groups] = await pool.query('SELECT * FROM gaming_groups ORDER BY created_at DESC');

    // Convert show_in_dashboard to boolean
    const formattedGroups = groups.map(group => ({
      ...group,
      showInDashboard: Boolean(group.show_in_dashboard)
    }));

    res.json(formattedGroups);
  } catch (error) {
    console.error('Error fetching gaming groups:', error);
    res.status(500).json({ message: 'Failed to fetch gaming groups' });
  }
});

// Get gaming groups for dashboard (public access)
app.get('/dashboard/gaming-groups', async (req, res) => {
  try {
    const [groups] = await pool.query(`
      SELECT gg.id, gg.name, gg.description
      FROM gaming_groups gg
      WHERE gg.show_in_dashboard = true
      ORDER BY gg.name ASC
    `);

    // For each group, get the teams with their scores
    const groupsWithTeams = await Promise.all(groups.map(async (group) => {
      const [teams] = await pool.query(`
        SELECT t.id, t.name, t.description, ggt.score
        FROM teams t
        INNER JOIN gaming_group_teams ggt ON t.id = ggt.team_id
        WHERE ggt.gaming_group_id = ?
        ORDER BY ggt.score DESC, t.name ASC
      `, [group.id]);

      return {
        ...group,
        teams
      };
    }));

    res.json(groupsWithTeams);
  } catch (error) {
    console.error('Error fetching dashboard gaming groups:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
});

// Get a specific gaming group
app.get('/gaming-groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [groups] = await pool.query('SELECT * FROM gaming_groups WHERE id = ?', [id]);

    if (groups.length === 0) {
      return res.status(404).json({ message: 'Gaming group not found' });
    }

    res.json(groups[0]);
  } catch (error) {
    console.error('Error fetching gaming group:', error);
    res.status(500).json({ message: 'Failed to fetch gaming group' });
  }
});

// Create a new gaming group (admin only)
app.post('/gaming-groups', authenticateToken, async (req, res) => {
  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can create gaming groups' });
    }

    const { name, description, showInDashboard } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO gaming_groups (name, description, show_in_dashboard) VALUES (?, ?, ?)',
      [name, description || '', showInDashboard || false]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      description: description || '',
      showInDashboard: showInDashboard || false
    });
  } catch (error) {
    console.error('Error creating gaming group:', error);
    res.status(500).json({ message: 'Failed to create gaming group' });
  }
});

// Update a gaming group (admin only)
app.put('/gaming-groups/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can update gaming groups' });
    }

    const { id } = req.params;
    const { name, description, showInDashboard } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Check if group exists
    const [existingGroup] = await pool.query('SELECT id FROM gaming_groups WHERE id = ?', [id]);
    if (existingGroup.length === 0) {
      return res.status(404).json({ message: 'Gaming group not found' });
    }

    await pool.query(
      'UPDATE gaming_groups SET name = ?, description = ?, show_in_dashboard = ? WHERE id = ?',
      [name, description || '', showInDashboard !== undefined ? showInDashboard : false, id]
    );

    res.json({
      id: parseInt(id),
      name,
      description: description || '',
      showInDashboard: showInDashboard || false
    });
  } catch (error) {
    console.error('Error updating gaming group:', error);
    res.status(500).json({ message: 'Failed to update gaming group' });
  }
});

// Delete a gaming group (admin only)
app.delete('/gaming-groups/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can delete gaming groups' });
    }

    const { id } = req.params;

    // Check if group exists
    const [existingGroup] = await pool.query('SELECT id FROM gaming_groups WHERE id = ?', [id]);
    if (existingGroup.length === 0) {
      return res.status(404).json({ message: 'Gaming group not found' });
    }

    await pool.query('DELETE FROM gaming_groups WHERE id = ?', [id]);

    res.json({ message: 'Gaming group deleted successfully' });
  } catch (error) {
    console.error('Error deleting gaming group:', error);
    res.status(500).json({ message: 'Failed to delete gaming group' });
  }
});

// ==================== GAMES ENDPOINTS ====================

// Get all games (public access for dashboard)
app.get('/games', async (req, res) => {
  try {
    const { gaming_group_id } = req.query;

    let query = `
      SELECT g.*, gg.name as gaming_group_name
      FROM games g
      LEFT JOIN gaming_groups gg ON g.gaming_group_id = gg.id
    `;
    const params = [];

    if (gaming_group_id) {
      query += ' WHERE g.gaming_group_id = ?';
      params.push(gaming_group_id);
    }

    query += ' ORDER BY g.display_order ASC, g.created_at DESC';

    const [games] = await pool.query(query, params);

    // Get scoring for each game
    const gamesWithScoring = await Promise.all(
      games.map(async (game) => {
        const [scoring] = await pool.query(
          'SELECT id, place_name, place, score FROM game_scoring WHERE game_id = ? ORDER BY place ASC',
          [game.id]
        );
        return {
          id: game.id,
          name: game.name,
          description: game.description,
          minimumPoint: game.minimum_point,
          maximumPoint: game.maximum_point,
          gamingGroupId: game.gaming_group_id,
          gamingGroupName: game.gaming_group_name,
          showInDashboard: Boolean(game.show_in_dashboard),
          status: game.status,
          displayOrder: game.display_order,
          gameType: game.game_type || 'points',
          timingMode: game.timing_mode || 'server',
          countdownSeconds: game.countdown_seconds || 5,
          scoring: scoring.map(s => ({
            id: s.id,
            placeName: s.place_name,
            place: s.place,
            score: s.score
          })),
          createdAt: game.created_at,
          updatedAt: game.updated_at
        };
      })
    );

    res.json(gamesWithScoring);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ message: 'Failed to fetch games', error: error.message });
  }
});

// Get a specific game (public access for dashboard)
app.get('/games/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [games] = await pool.query(`
      SELECT g.*, gg.name as gaming_group_name
      FROM games g
      LEFT JOIN gaming_groups gg ON g.gaming_group_id = gg.id
      WHERE g.id = ?
    `, [id]);

    if (games.length === 0) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const game = games[0];

    // Get scoring
    const [scoring] = await pool.query(
      'SELECT id, place_name, place, score FROM game_scoring WHERE game_id = ? ORDER BY place ASC',
      [id]
    );

    res.json({
      id: game.id,
      name: game.name,
      description: game.description,
      minimumPoint: game.minimum_point,
      maximumPoint: game.maximum_point,
      gamingGroupId: game.gaming_group_id,
      gamingGroupName: game.gaming_group_name,
      showInDashboard: Boolean(game.show_in_dashboard),
      status: game.status,
      gameType: game.game_type || 'points',
      timingMode: game.timing_mode || 'server',
      countdownSeconds: game.countdown_seconds || 5,
      scoring: scoring.map(s => ({
        id: s.id,
        placeName: s.place_name,
        place: s.place,
        score: s.score
      })),
      createdAt: game.created_at,
      updatedAt: game.updated_at
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ message: 'Failed to fetch game' });
  }
});

// Create a new game (admin only)
app.post('/games', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can create games' });
    }

    await connection.beginTransaction();

    const { name, description, minimumPoint, maximumPoint, gamingGroupId, showInDashboard, status, scoring, gameType, timingMode, countdownSeconds } = req.body;

    // Validate input
    if (!name || !gamingGroupId) {
      await connection.rollback();
      return res.status(400).json({ message: 'Name and gaming group are required' });
    }

    // Verify gaming group exists
    const [groups] = await connection.query('SELECT id FROM gaming_groups WHERE id = ?', [gamingGroupId]);
    if (groups.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Gaming group not found' });
    }

    // Get the max display_order for this gaming group
    const [maxOrder] = await connection.query(
      'SELECT COALESCE(MAX(display_order), -1) as max_order FROM games WHERE gaming_group_id = ?',
      [gamingGroupId]
    );
    const displayOrder = maxOrder[0].max_order + 1;

    // Insert game
    const [result] = await connection.query(
      `INSERT INTO games (name, description, minimum_point, maximum_point, gaming_group_id, show_in_dashboard, status, display_order, game_type, timing_mode, countdown_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || '', minimumPoint || 0, maximumPoint || 100, gamingGroupId, showInDashboard !== false, status || 'coming', displayOrder, gameType || 'points', timingMode || 'server', countdownSeconds || 5]
    );

    const gameId = result.insertId;

    // Insert default scoring if not provided (only for points-based games)
    if (gameType !== 'time') {
      const scoringData = scoring && scoring.length > 0 ? scoring : [
        { placeName: '1st', place: 1, score: 5 },
        { placeName: 'other', place: -1, score: 0 }
      ];

      for (const score of scoringData) {
        await connection.query(
          'INSERT INTO game_scoring (game_id, place_name, place, score) VALUES (?, ?, ?, ?)',
          [gameId, score.placeName, score.place, score.score]
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      id: gameId,
      name,
      description: description || '',
      minimumPoint: minimumPoint || 0,
      maximumPoint: maximumPoint || 100,
      gamingGroupId,
      showInDashboard: showInDashboard !== false,
      status: status || 'coming',
      gameType: gameType || 'points',
      timingMode: timingMode || 'server',
      countdownSeconds: countdownSeconds || 5,
      scoring: gameType !== 'time' ? (scoring || []) : []
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating game:', error);
    res.status(500).json({ message: 'Failed to create game', error: error.message });
  } finally {
    connection.release();
  }
});

// Update a game (admin only)
app.put('/games/:id', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can update games' });
    }

    await connection.beginTransaction();

    const { id } = req.params;
    const { name, description, minimumPoint, maximumPoint, gamingGroupId, showInDashboard, status, scoring, gameType, timingMode, countdownSeconds } = req.body;

    // Validate input
    if (!name || !gamingGroupId) {
      await connection.rollback();
      return res.status(400).json({ message: 'Name and gaming group are required' });
    }

    // Check if game exists
    const [existingGame] = await connection.query('SELECT id, game_type FROM games WHERE id = ?', [id]);
    if (existingGame.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Game not found' });
    }

    // Verify gaming group exists
    const [groups] = await connection.query('SELECT id FROM gaming_groups WHERE id = ?', [gamingGroupId]);
    if (groups.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Gaming group not found' });
    }

    // Update game
    await connection.query(
      `UPDATE games
       SET name = ?, description = ?, minimum_point = ?, maximum_point = ?,
           gaming_group_id = ?, show_in_dashboard = ?, status = ?,
           game_type = ?, timing_mode = ?, countdown_seconds = ?
       WHERE id = ?`,
      [name, description || '', minimumPoint || 0, maximumPoint || 100, gamingGroupId, showInDashboard !== false, status || 'coming', gameType || 'points', timingMode || 'server', countdownSeconds || 5, id]
    );

    // Update scoring if provided (only for points-based games)
    const effectiveGameType = gameType || existingGame[0].game_type || 'points';
    if (effectiveGameType !== 'time' && scoring && scoring.length > 0) {
      // Delete existing scoring
      await connection.query('DELETE FROM game_scoring WHERE game_id = ?', [id]);

      // Insert new scoring
      for (const score of scoring) {
        await connection.query(
          'INSERT INTO game_scoring (game_id, place_name, place, score) VALUES (?, ?, ?, ?)',
          [id, score.placeName, score.place, score.score]
        );
      }
    }

    await connection.commit();

    res.json({
      id: parseInt(id),
      name,
      description: description || '',
      minimumPoint: minimumPoint || 0,
      maximumPoint: maximumPoint || 100,
      gamingGroupId,
      showInDashboard: showInDashboard !== false,
      status: status || 'coming',
      gameType: gameType || 'points',
      timingMode: timingMode || 'server',
      countdownSeconds: countdownSeconds || 5,
      scoring: scoring || []
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating game:', error);
    res.status(500).json({ message: 'Failed to update game' });
  } finally {
    connection.release();
  }
});

// Delete a game (admin only)
app.delete('/games/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can delete games' });
    }

    const { id } = req.params;

    // Check if game exists
    const [existingGame] = await pool.query('SELECT id FROM games WHERE id = ?', [id]);
    if (existingGame.length === 0) {
      return res.status(404).json({ message: 'Game not found' });
    }

    await pool.query('DELETE FROM games WHERE id = ?', [id]);

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ message: 'Failed to delete game' });
  }
});

// Update game status (admin only)
app.put('/games/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can update game status' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['coming', 'running', 'past'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required (coming, running, past)' });
    }

    const [result] = await pool.query(
      'UPDATE games SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json({ message: 'Game status updated successfully', status });
  } catch (error) {
    console.error('Error updating game status:', error);
    res.status(500).json({ message: 'Failed to update game status' });
  }
});

// Get game scores (public access for dashboard)
app.get('/games/:id/scores', async (req, res) => {
  try {
    const { id } = req.params;

    const [scores] = await pool.query(`
      SELECT gs.*, t.name as teamName
      FROM game_scores gs
      INNER JOIN teams t ON gs.team_id = t.id
      WHERE gs.game_id = ?
      ORDER BY gs.score DESC
    `, [id]);

    // Convert to camelCase
    const formattedScores = scores.map(score => ({
      id: score.id,
      gameId: score.game_id,
      teamId: score.team_id,
      teamName: score.teamName,
      score: score.score
    }));

    res.json(formattedScores);
  } catch (error) {
    console.error('Error fetching game scores:', error);
    res.status(500).json({ message: 'Failed to fetch game scores' });
  }
});

// Helper function to calculate and update scores for a gaming group
async function calculateGroupScores(connection, groupId) {
  // Get all teams in the gaming group
  const [teams] = await connection.query(
    'SELECT team_id FROM gaming_group_teams WHERE gaming_group_id = ?',
    [groupId]
  );

  if (teams.length === 0) {
    return;
  }

  // Get all games in the gaming group
  const [games] = await connection.query(
    'SELECT id FROM games WHERE gaming_group_id = ?',
    [groupId]
  );

  const teamScores = {};

  // Initialize scores for all teams
  teams.forEach(team => {
    teamScores[team.team_id] = 0;
  });

  // Process each game
  for (const game of games) {
    const gameId = game.id;

    // Get all team scores for this game
    const [gameScores] = await connection.query(
      `SELECT team_id, score
       FROM game_scores
       WHERE game_id = ? AND team_id IN (?)`,
      [gameId, teams.map(t => t.team_id)]
    );

    // Get scoring configuration for this game
    const [scoringConfig] = await connection.query(
      'SELECT place, score FROM game_scoring WHERE game_id = ? ORDER BY place ASC',
      [gameId]
    );

    console.log(`Game ${gameId}: ${gameScores.length} scores, ${scoringConfig.length} scoring rules`);

    if (gameScores.length === 0 || scoringConfig.length === 0) {
      // Skip games without scores or scoring configuration
      continue;
    }

    // Sort teams by their game scores (descending) to determine placements
    const sortedTeams = gameScores.sort((a, b) => b.score - a.score);

    // Assign placements and calculate points
    let currentPlace = 1;
    let previousScore = null;

    for (let i = 0; i < sortedTeams.length; i++) {
      const teamScore = sortedTeams[i];

      // Handle ties - teams with same score get same placement
      if (previousScore !== null && teamScore.score < previousScore) {
        currentPlace = i + 1;
      }

      // Find the points for this placement in scoring config
      let pointsAwarded = 0;
      const exactMatch = scoringConfig.find(sc => sc.place === currentPlace);

      if (exactMatch) {
        pointsAwarded = exactMatch.score;
      } else {
        // Look for "other" placement (place = -1)
        const otherMatch = scoringConfig.find(sc => sc.place === -1);
        if (otherMatch) {
          pointsAwarded = otherMatch.score;
        }
      }

      console.log(`  Team ${teamScore.team_id}: game score ${teamScore.score}, place ${currentPlace}, points awarded ${pointsAwarded}`);

      // Add points to team's total score
      teamScores[teamScore.team_id] += pointsAwarded;

      previousScore = teamScore.score;
    }
  }

  console.log('Final team scores:', teamScores);

  // Update all team scores in gaming_group_teams
  for (const [teamId, totalScore] of Object.entries(teamScores)) {
    await connection.query(
      'UPDATE gaming_group_teams SET score = ? WHERE gaming_group_id = ? AND team_id = ?',
      [totalScore, groupId, teamId]
    );
  }

  return teamScores;
}

// Save/update game score for a team
app.post('/games/:id/scores', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { teamId, score } = req.body;

    if (!teamId || score === undefined) {
      return res.status(400).json({ message: 'Team ID and score are required' });
    }

    // Get game to validate score range and get gaming group
    const [games] = await connection.query(
      'SELECT minimum_point, maximum_point, gaming_group_id FROM games WHERE id = ?',
      [id]
    );
    if (games.length === 0) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const game = games[0];
    if (score < game.minimum_point || score > game.maximum_point) {
      return res.status(400).json({
        message: `Score must be between ${game.minimum_point} and ${game.maximum_point}`
      });
    }

    await connection.beginTransaction();

    // Insert or update score
    await connection.query(
      `INSERT INTO game_scores (game_id, team_id, score)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE score = ?`,
      [id, teamId, score, score]
    );

    // Automatically recalculate group scores
    await calculateGroupScores(connection, game.gaming_group_id);

    await connection.commit();

    res.json({ message: 'Score saved successfully', gameId: parseInt(id), teamId, score });
  } catch (error) {
    await connection.rollback();
    console.error('Error saving game score:', error);
    res.status(500).json({ message: 'Failed to save game score' });
  } finally {
    connection.release();
  }
});

// Reorder games (admin only)
app.put('/games/reorder', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Check if user is administrator
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can reorder games' });
    }

    await connection.beginTransaction();

    const { gameOrders } = req.body; // Array of {id, displayOrder}

    if (!gameOrders || !Array.isArray(gameOrders)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Game orders array is required' });
    }

    // Update display_order for each game
    for (const gameOrder of gameOrders) {
      await connection.query(
        'UPDATE games SET display_order = ? WHERE id = ?',
        [gameOrder.displayOrder, gameOrder.id]
      );
    }

    await connection.commit();

    res.json({ message: 'Games reordered successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error reordering games:', error);
    res.status(500).json({ message: 'Failed to reorder games' });
  } finally {
    connection.release();
  }
});

// ==================== TEAMS ENDPOINTS ====================

// Get all teams
app.get('/teams', authenticateToken, async (req, res) => {
  try {
    const [teams] = await pool.query('SELECT * FROM teams ORDER BY name ASC');
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ message: 'Failed to fetch teams' });
  }
});

// Get a specific team
app.get('/teams/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [teams] = await pool.query('SELECT * FROM teams WHERE id = ?', [id]);

    if (teams.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(teams[0]);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ message: 'Failed to fetch team' });
  }
});

// Create a new team (admin only)
app.post('/teams', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can create teams' });
    }

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO teams (name, description) VALUES (?, ?)',
      [name, description || '']
    );

    res.status(201).json({
      id: result.insertId,
      name,
      description: description || ''
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ message: 'Failed to create team' });
  }
});

// Update a team (admin only)
app.put('/teams/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can update teams' });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const [existingTeam] = await pool.query('SELECT id FROM teams WHERE id = ?', [id]);
    if (existingTeam.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    await pool.query(
      'UPDATE teams SET name = ?, description = ? WHERE id = ?',
      [name, description || '', id]
    );

    res.json({
      id: parseInt(id),
      name,
      description: description || ''
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ message: 'Failed to update team' });
  }
});

// Delete a team (admin only)
app.delete('/teams/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can delete teams' });
    }

    const { id } = req.params;

    const [existingTeam] = await pool.query('SELECT id FROM teams WHERE id = ?', [id]);
    if (existingTeam.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    await pool.query('DELETE FROM teams WHERE id = ?', [id]);

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ message: 'Failed to delete team' });
  }
});

// Add team to gaming group (admin only)
app.post('/gaming-groups/:groupId/teams', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can add teams to groups' });
    }

    const { groupId } = req.params;
    const { teamId, score } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO gaming_group_teams (gaming_group_id, team_id, score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score = ?',
      [groupId, teamId, score || 0, score || 0]
    );

    res.status(201).json({
      gamingGroupId: parseInt(groupId),
      teamId: parseInt(teamId),
      score: score || 0
    });
  } catch (error) {
    console.error('Error adding team to group:', error);
    res.status(500).json({ message: 'Failed to add team to gaming group' });
  }
});

// Get teams in a gaming group (public access for dashboard)
app.get('/gaming-groups/:groupId/teams', async (req, res) => {
  try {
    const { groupId } = req.params;

    const [teams] = await pool.query(`
      SELECT t.*, ggt.score
      FROM teams t
      INNER JOIN gaming_group_teams ggt ON t.id = ggt.team_id
      WHERE ggt.gaming_group_id = ?
      ORDER BY ggt.score DESC, t.name ASC
    `, [groupId]);

    res.json(teams);
  } catch (error) {
    console.error('Error fetching gaming group teams:', error);
    res.status(500).json({ message: 'Failed to fetch teams' });
  }
});

// Remove team from gaming group (admin only)
app.delete('/gaming-groups/:groupId/teams/:teamId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can remove teams from groups' });
    }

    const { groupId, teamId } = req.params;

    await pool.query(
      'DELETE FROM gaming_group_teams WHERE gaming_group_id = ? AND team_id = ?',
      [groupId, teamId]
    );

    res.json({ message: 'Team removed from gaming group successfully' });
  } catch (error) {
    console.error('Error removing team from group:', error);
    res.status(500).json({ message: 'Failed to remove team from gaming group' });
  }
});

// Calculate and update team scores for a gaming group based on game placements
app.post('/gaming-groups/:groupId/calculate-scores', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators can calculate scores' });
    }

    const { groupId } = req.params;

    await connection.beginTransaction();

    const teamScores = await calculateGroupScores(connection, groupId);

    await connection.commit();

    res.json({
      message: 'Team scores calculated successfully',
      teamScores
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error calculating team scores:', error);
    res.status(500).json({ message: 'Failed to calculate team scores' });
  } finally {
    connection.release();
  }
});

// ==================== TIME SYNC ENDPOINT ====================

// Time sync endpoint for client clock synchronization
app.get('/time-sync', (req, res) => {
  res.json({ serverTime: Date.now() });
});

// ==================== TEAM ACCESS CODES ENDPOINTS ====================

// Generate 3-digit code
function generateCode() {
  return Math.floor(100 + Math.random() * 900).toString();
}

// Generate unique code for a game
async function generateUniqueCode(gameId) {
  let code;
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    code = generateCode();
    const [existing] = await pool.query(
      'SELECT id FROM team_access_codes WHERE game_id = ? AND code = ?',
      [gameId, code]
    );
    if (existing.length === 0) {
      return code;
    }
    attempts++;
  }
  throw new Error('Could not generate unique code');
}

// Get team access codes for a game
app.get('/games/:id/access-codes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [codes] = await pool.query(`
      SELECT tac.*, t.name as team_name
      FROM team_access_codes tac
      JOIN teams t ON t.id = tac.team_id
      WHERE tac.game_id = ?
      ORDER BY t.name ASC
    `, [id]);

    res.json(codes.map(c => ({
      id: c.id,
      gameId: c.game_id,
      teamId: c.team_id,
      teamName: c.team_name,
      code: c.code,
      status: c.status,
      connectedAt: c.connected_at,
      reactionTimeMs: c.reaction_time_ms,
      offlineAllowed: c.offline_allowed === 1,
      isSelected: c.is_selected === 1
    })));
  } catch (error) {
    console.error('Error fetching access codes:', error);
    res.status(500).json({ message: 'Failed to fetch access codes' });
  }
});

// Generate code for a single team
app.post('/games/:id/access-codes/generate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required' });
    }

    const code = await generateUniqueCode(id);

    await pool.query(`
      INSERT INTO team_access_codes (game_id, team_id, code, status)
      VALUES (?, ?, ?, 'available')
      ON DUPLICATE KEY UPDATE code = ?, status = 'available', socket_id = NULL
    `, [id, teamId, code, code]);

    res.json({ gameId: parseInt(id), teamId, code });
  } catch (error) {
    console.error('Error generating access code:', error);
    res.status(500).json({ message: 'Failed to generate access code' });
  }
});

// Generate codes for multiple teams
app.post('/games/:id/access-codes/generate-bulk', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamIds } = req.body;

    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ message: 'Team IDs array is required' });
    }

    const results = [];
    for (const teamId of teamIds) {
      const code = await generateUniqueCode(id);
      await pool.query(`
        INSERT INTO team_access_codes (game_id, team_id, code, status)
        VALUES (?, ?, ?, 'available')
        ON DUPLICATE KEY UPDATE code = ?, status = 'available', socket_id = NULL
      `, [id, teamId, code, code]);
      results.push({ teamId, code });
    }

    res.json({ gameId: parseInt(id), codes: results });
  } catch (error) {
    console.error('Error generating access codes:', error);
    res.status(500).json({ message: 'Failed to generate access codes' });
  }
});

// Reset code for a team (generate new code and kick existing connection)
app.post('/games/:id/access-codes/reset', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required' });
    }

    // Get existing code to kick socket
    const [existing] = await pool.query(
      'SELECT socket_id FROM team_access_codes WHERE game_id = ? AND team_id = ?',
      [id, teamId]
    );

    if (existing.length > 0 && existing[0].socket_id) {
      const socket = io.sockets.sockets.get(existing[0].socket_id);
      if (socket) {
        socket.emit('team:kicked', { reason: 'Code was reset by moderator' });
        socket.disconnect(true);
      }
    }

    // Generate new code
    const code = await generateUniqueCode(id);
    await pool.query(`
      UPDATE team_access_codes
      SET code = ?, status = 'available', socket_id = NULL, connected_at = NULL,
          pressed_at = NULL, reaction_time_ms = NULL
      WHERE game_id = ? AND team_id = ?
    `, [code, id, teamId]);

    res.json({ gameId: parseInt(id), teamId, code });
  } catch (error) {
    console.error('Error resetting access code:', error);
    res.status(500).json({ message: 'Failed to reset access code' });
  }
});

// Update team offline mode
app.patch('/games/:id/access-codes/:teamId/offline', authenticateToken, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { offlineAllowed } = req.body;

    await pool.query(`
      UPDATE team_access_codes
      SET offline_allowed = ?
      WHERE game_id = ? AND team_id = ?
    `, [offlineAllowed ? 1 : 0, id, teamId]);

    // Notify the team via socket if connected
    const [codes] = await pool.query(
      'SELECT socket_id FROM team_access_codes WHERE game_id = ? AND team_id = ?',
      [id, teamId]
    );
    if (codes.length > 0 && codes[0].socket_id) {
      const socket = io.sockets.sockets.get(codes[0].socket_id);
      if (socket) {
        socket.emit('team:settings', { offlineAllowed });
      }
    }

    res.json({ success: true, teamId: parseInt(teamId), offlineAllowed });
  } catch (error) {
    console.error('Error updating offline mode:', error);
    res.status(500).json({ message: 'Failed to update offline mode' });
  }
});

// Update team selection for current round
app.patch('/games/:id/access-codes/:teamId/selected', authenticateToken, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { isSelected } = req.body;

    await pool.query(`
      UPDATE team_access_codes
      SET is_selected = ?
      WHERE game_id = ? AND team_id = ?
    `, [isSelected ? 1 : 0, id, teamId]);

    // Notify the team via socket if connected
    const [codes] = await pool.query(
      'SELECT socket_id FROM team_access_codes WHERE game_id = ? AND team_id = ?',
      [id, teamId]
    );
    if (codes.length > 0 && codes[0].socket_id) {
      const socket = io.sockets.sockets.get(codes[0].socket_id);
      if (socket) {
        socket.emit('team:selected', { isSelected });
      }
    }

    // Notify evaluators
    io.to(`evaluator:${id}`).emit('team:selectionChanged', {
      teamId: parseInt(teamId),
      isSelected
    });

    res.json({ success: true, teamId: parseInt(teamId), isSelected });
  } catch (error) {
    console.error('Error updating team selection:', error);
    res.status(500).json({ message: 'Failed to update team selection' });
  }
});

// Manual time recording by evaluator
app.post('/games/:id/access-codes/:teamId/manual-time', authenticateToken, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { reactionTimeMs, points } = req.body;

    // Get team name for event log
    const [teams] = await pool.query('SELECT name FROM teams WHERE id = ?', [teamId]);
    const teamName = teams.length > 0 ? teams[0].name : 'Unknown Team';

    // Update the game state if active
    const gameState = activeGames.get(parseInt(id));
    if (gameState) {
      gameState.results.set(parseInt(teamId), {
        teamId: parseInt(teamId),
        teamName,
        reactionTimeMs,
        points,
        timedOut: false,
        manualEntry: true
      });

      // Broadcast to all clients
      io.to(`game:${id}`).emit('team:pressed', {
        teamId: parseInt(teamId),
        teamName,
        reactionTimeMs,
        displayTime: (reactionTimeMs / 1000).toFixed(1),
        points,
        manualEntry: true
      });
    }

    // Log the event
    await pool.query(`
      INSERT INTO game_event_log (game_id, description, actor, actor_type)
      VALUES (?, ?, ?, 'evaluator')
    `, [id, `Manual time recorded for ${teamName}: ${(reactionTimeMs / 1000).toFixed(1)}s = ${points} pts`, 'Evaluator']);

    res.json({ success: true, teamId: parseInt(teamId), reactionTimeMs, points });
  } catch (error) {
    console.error('Error recording manual time:', error);
    res.status(500).json({ message: 'Failed to record manual time' });
  }
});

// Get game event log
app.get('/games/:id/event-log', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [events] = await pool.query(`
      SELECT id, description, timestamp, actor, actor_type
      FROM game_event_log
      WHERE game_id = ?
      ORDER BY timestamp DESC
      LIMIT 100
    `, [id]);

    res.json(events);
  } catch (error) {
    console.error('Error fetching event log:', error);
    res.status(500).json({ message: 'Failed to fetch event log' });
  }
});

// Clear game event log
app.delete('/games/:id/event-log', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM game_event_log WHERE game_id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing event log:', error);
    res.status(500).json({ message: 'Failed to clear event log' });
  }
});

// Validate access code (public endpoint for team board)
app.get('/teamboard/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { gameId } = req.query;

    let query = `
      SELECT tac.*, t.name as team_name, g.name as game_name, g.game_type,
             g.timing_mode, g.maximum_point, g.countdown_seconds, g.status as game_status
      FROM team_access_codes tac
      JOIN teams t ON t.id = tac.team_id
      JOIN games g ON g.id = tac.game_id
      WHERE tac.code = ?
    `;
    const params = [code];

    if (gameId) {
      query += ' AND tac.game_id = ?';
      params.push(gameId);
    }

    const [codes] = await pool.query(query, params);

    if (codes.length === 0) {
      return res.status(404).json({ message: 'Invalid code' });
    }

    const c = codes[0];

    if (c.status === 'active') {
      return res.status(403).json({ message: 'Code is already in use' });
    }

    if (c.status === 'disabled') {
      return res.status(403).json({ message: 'Code has been disabled' });
    }

    res.json({
      gameId: c.game_id,
      teamId: c.team_id,
      teamName: c.team_name,
      gameName: c.game_name,
      gameType: c.game_type,
      gameStatus: c.game_status,
      timingMode: c.timing_mode,
      maxPoints: c.maximum_point,
      countdownSeconds: c.countdown_seconds,
      status: c.status,
      isSelected: c.is_selected === 1,
      offlineAllowed: c.offline_allowed === 1
    });
  } catch (error) {
    console.error('Error validating code:', error);
    res.status(500).json({ message: 'Failed to validate code' });
  }
});

// ==================== SOCKET.IO HANDLERS ====================

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Team joins with access code
  socket.on('team:join', async ({ code, gameId }) => {
    try {
      const [codes] = await pool.query(`
        SELECT tac.*, t.name as team_name, g.timing_mode, g.status as game_status
        FROM team_access_codes tac
        JOIN teams t ON t.id = tac.team_id
        JOIN games g ON g.id = tac.game_id
        WHERE tac.code = ? AND tac.game_id = ?
      `, [code, gameId]);

      if (codes.length === 0) {
        socket.emit('team:rejected', { reason: 'Invalid code' });
        return;
      }

      const accessCode = codes[0];

      // Check if game is running - only allow connections when game is running
      if (accessCode.game_status !== 'running') {
        socket.emit('team:rejected', {
          reason: accessCode.game_status === 'coming'
            ? 'Game has not started yet'
            : 'Game has already ended'
        });
        return;
      }

      if (accessCode.status === 'active' && accessCode.socket_id !== socket.id) {
        socket.emit('team:rejected', { reason: 'Code is already in use' });
        return;
      }

      if (accessCode.status === 'disabled') {
        socket.emit('team:rejected', { reason: 'Code has been disabled' });
        return;
      }

      // Lock the code to this socket
      await pool.query(`
        UPDATE team_access_codes
        SET status = 'active', socket_id = ?, connected_at = NOW()
        WHERE id = ?
      `, [socket.id, accessCode.id]);

      socket.accessCodeId = accessCode.id;
      socket.teamId = accessCode.team_id;
      socket.gameId = gameId;
      socket.teamName = accessCode.team_name;
      socket.timingMode = accessCode.timing_mode;
      socket.offlineAllowed = accessCode.offline_allowed === 1;
      socket.isSelected = accessCode.is_selected === 1;

      socket.join(`game:${gameId}`);

      socket.emit('team:validated', {
        teamName: accessCode.team_name,
        gameId,
        teamId: accessCode.team_id,
        isSelected: accessCode.is_selected === 1,
        offlineAllowed: accessCode.offline_allowed === 1
      });

      // Send current game state if game is running
      const gameState = activeGames.get(parseInt(gameId));
      if (gameState) {
        const teamResult = gameState.results.get(accessCode.team_id);
        socket.emit('team:state', {
          phase: gameState.phase, // 'countdown', 'running', 'completed'
          goTime: gameState.goTime,
          maxTimeMs: gameState.maxTimeMs,
          selectedTeams: Array.from(gameState.selectedTeams || []),
          result: teamResult ? {
            reactionTimeMs: teamResult.reactionTimeMs,
            displayTime: (teamResult.reactionTimeMs / 1000).toFixed(1),
            points: teamResult.points,
            manualEntry: teamResult.manualEntry || false
          } : null
        });
      }

      // Notify evaluators
      io.to(`evaluator:${gameId}`).emit('team:connected', {
        teamId: accessCode.team_id,
        teamName: accessCode.team_name
      });

      console.log(`Team ${accessCode.team_name} connected to game ${gameId}`);
    } catch (error) {
      console.error('Error in team:join:', error);
      socket.emit('team:rejected', { reason: 'Server error' });
    }
  });

  // Evaluator joins to monitor game
  socket.on('evaluator:join', async ({ gameId, token }) => {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      socket.gameId = gameId;
      socket.isEvaluator = true;

      socket.join(`evaluator:${gameId}`);
      socket.join(`game:${gameId}`);

      // Send current game state if exists
      const gameState = activeGames.get(parseInt(gameId));
      if (gameState) {
        socket.emit('game:state', gameState);
      }

      // Send current team connection statuses
      const [codes] = await pool.query(`
        SELECT tac.team_id, tac.status, t.name as team_name
        FROM team_access_codes tac
        JOIN teams t ON t.id = tac.team_id
        WHERE tac.game_id = ?
      `, [gameId]);

      socket.emit('teams:status', codes.map(c => ({
        teamId: c.team_id,
        teamName: c.team_name,
        status: c.status
      })));

      console.log(`Evaluator joined game ${gameId}`);
    } catch (error) {
      console.error('Error in evaluator:join:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  // Audience joins to watch game (no auth required)
  socket.on('audience:join', async ({ gameId }) => {
    try {
      socket.gameId = gameId;
      socket.isAudience = true;

      // Join the game room to receive broadcasts
      socket.join(`game:${gameId}`);

      // Send current game state if exists
      const gameState = activeGames.get(parseInt(gameId));
      if (gameState) {
        // Send current results if any
        const results = Array.from(gameState.results.values()).map(r => ({
          ...r,
          displayTime: (r.reactionTimeMs / 1000).toFixed(1)
        }));
        socket.emit('game:state', {
          status: gameState.status,
          results
        });
      }

      console.log(`Audience member joined game ${gameId}`);
    } catch (error) {
      console.error('Error in audience:join:', error);
    }
  });

  // Evaluator starts the game round
  socket.on('game:start', async ({ gameId, countdownSeconds }) => {
    if (!socket.isEvaluator) return;

    try {
      const countdown = countdownSeconds || 5;
      const now = Date.now();
      const goTime = now + (countdown * 1000);

      // Clear any existing timeouts from previous round
      const existingState = activeGames.get(parseInt(gameId));
      if (existingState) {
        if (existingState.goTimeout) clearTimeout(existingState.goTimeout);
        if (existingState.endTimeout) clearTimeout(existingState.endTimeout);
      }

      // Get game details
      const [games] = await pool.query(
        'SELECT maximum_point, timing_mode FROM games WHERE id = ?',
        [gameId]
      );
      if (games.length === 0) return;

      const game = games[0];
      const maxTimeMs = game.maximum_point * 100; // max_point in tenths of seconds

      // Reset team results for this round (only for selected teams)
      await pool.query(`
        UPDATE team_access_codes
        SET pressed_at = NULL, reaction_time_ms = NULL
        WHERE game_id = ? AND is_selected = 1
      `, [gameId]);

      // Get connected AND selected teams (only 'active' status and is_selected = 1 can play)
      const [connectedTeams] = await pool.query(`
        SELECT tac.team_id, tac.socket_id, tac.offline_allowed, t.name as team_name
        FROM team_access_codes tac
        JOIN teams t ON t.id = tac.team_id
        WHERE tac.game_id = ? AND tac.status = 'active' AND tac.is_selected = 1
      `, [gameId]);

      // Get all selected teams (including offline ones)
      const [selectedTeams] = await pool.query(`
        SELECT tac.team_id, tac.offline_allowed, t.name as team_name
        FROM team_access_codes tac
        JOIN teams t ON t.id = tac.team_id
        WHERE tac.game_id = ? AND tac.is_selected = 1
      `, [gameId]);

      // Store game state
      const gameState = {
        status: 'countdown',
        phase: 'countdown',
        goTime,
        maxTimeMs,
        countdownSeconds: countdown,
        timingMode: game.timing_mode,
        maxPoints: game.maximum_point,
        startedAt: now,
        results: new Map(),
        connectedTeams: connectedTeams.map(t => t.team_id),
        selectedTeams: selectedTeams.map(t => t.team_id),
        goTimeout: null,
        endTimeout: null
      };
      activeGames.set(parseInt(gameId), gameState);

      // Log event
      const teamNames = selectedTeams.map(t => t.team_name).join(', ');
      await pool.query(`
        INSERT INTO game_event_log (game_id, description, actor, actor_type)
        VALUES (?, ?, 'Evaluator', 'evaluator')
      `, [gameId, `Game started with ${selectedTeams.length} team(s): ${teamNames}`]);

      // Broadcast countdown to all clients in game room
      io.to(`game:${gameId}`).emit('game:countdown', {
        startsAt: goTime,
        countdownSeconds: countdown,
        maxTimeMs,
        serverTime: now,
        selectedTeams: gameState.selectedTeams
      });

      // Schedule GO event
      gameState.goTimeout = setTimeout(() => {
        const state = activeGames.get(parseInt(gameId));
        if (state && state.status === 'countdown') {
          state.status = 'running';
          state.phase = 'running';
          state.goTime = Date.now();
          io.to(`game:${gameId}`).emit('game:go', {
            goTime: state.goTime,
            maxTimeMs
          });
        }
      }, countdown * 1000);

      // Schedule timeout
      gameState.endTimeout = setTimeout(() => {
        endRound(gameId);
      }, (countdown * 1000) + maxTimeMs + 500);

      console.log(`Game ${gameId} started with ${countdown}s countdown, maxTime: ${maxTimeMs}ms`);
    } catch (error) {
      console.error('Error in game:start:', error);
    }
  });

  // Team presses the button
  socket.on('team:press', async ({ pressTime }) => {
    if (!socket.teamId || !socket.gameId) return;

    try {
      const gameState = activeGames.get(parseInt(socket.gameId));
      if (!gameState || gameState.status !== 'running') {
        socket.emit('press:rejected', { reason: 'Game not running' });
        return;
      }

      // Check if team is selected for this round
      if (!gameState.selectedTeams.includes(socket.teamId)) {
        socket.emit('press:rejected', { reason: 'Your team is not selected for this round' });
        return;
      }

      // Check if already pressed
      if (gameState.results.has(socket.teamId)) {
        socket.emit('press:rejected', { reason: 'Already pressed' });
        return;
      }

      // Calculate reaction time
      let reactionTimeMs;
      if (socket.timingMode === 'client' && pressTime) {
        // Client-trusted: use client's reported time
        reactionTimeMs = pressTime - gameState.goTime;
      } else {
        // Server-trusted: use server receive time
        reactionTimeMs = Date.now() - gameState.goTime;
      }

      // Clamp to valid range
      reactionTimeMs = Math.max(0, Math.min(reactionTimeMs, gameState.maxTimeMs + 100));

      // Calculate points
      const points = Math.max(0, gameState.maxPoints - Math.floor(reactionTimeMs / 100));

      // Store result
      gameState.results.set(socket.teamId, {
        teamId: socket.teamId,
        teamName: socket.teamName,
        reactionTimeMs,
        points,
        pressedAt: Date.now()
      });

      // Update database
      await pool.query(`
        UPDATE team_access_codes
        SET pressed_at = NOW(), reaction_time_ms = ?
        WHERE game_id = ? AND team_id = ?
      `, [reactionTimeMs, socket.gameId, socket.teamId]);

      // Acknowledge to team
      socket.emit('press:confirmed', {
        reactionTimeMs,
        displayTime: (reactionTimeMs / 1000).toFixed(1),
        points
      });

      // Notify evaluators and audience (game room)
      const pressedData = {
        teamId: socket.teamId,
        teamName: socket.teamName,
        reactionTimeMs,
        displayTime: (reactionTimeMs / 1000).toFixed(1),
        points
      };
      io.to(`evaluator:${socket.gameId}`).emit('team:pressed', pressedData);
      io.to(`game:${socket.gameId}`).emit('team:pressed', pressedData);

      console.log(`Team ${socket.teamName} pressed at ${reactionTimeMs}ms = ${points} points`);

      // Check if all connected teams have pressed
      const allPressed = gameState.connectedTeams.every(tid => gameState.results.has(tid));
      if (allPressed) {
        endRound(socket.gameId);
      }
    } catch (error) {
      console.error('Error in team:press:', error);
    }
  });

  // Evaluator discards the round
  socket.on('game:discard', async ({ gameId }) => {
    if (!socket.isEvaluator) return;

    try {
      const gameState = activeGames.get(parseInt(gameId));
      if (gameState) {
        // Clear any pending timeouts
        if (gameState.goTimeout) clearTimeout(gameState.goTimeout);
        if (gameState.endTimeout) clearTimeout(gameState.endTimeout);
        gameState.status = 'discarded';
      }

      // Reset team results
      await pool.query(`
        UPDATE team_access_codes
        SET pressed_at = NULL, reaction_time_ms = NULL
        WHERE game_id = ?
      `, [gameId]);

      // Notify all clients
      io.to(`game:${gameId}`).emit('game:discarded', {
        message: 'Round discarded by moderator'
      });

      activeGames.delete(parseInt(gameId));

      console.log(`Game ${gameId} round discarded`);
    } catch (error) {
      console.error('Error in game:discard:', error);
    }
  });

  // Evaluator confirms and saves results
  socket.on('game:confirm', async ({ gameId }) => {
    if (!socket.isEvaluator) return;

    try {
      const gameState = activeGames.get(parseInt(gameId));
      if (!gameState || (gameState.status !== 'completed' && gameState.status !== 'running')) {
        socket.emit('error', { message: 'No active round to confirm' });
        return;
      }

      if (gameState.results.size === 0) {
        socket.emit('error', { message: 'No results to confirm yet' });
        return;
      }

      // Initialize confirmedResults set if not exists
      if (!gameState.confirmedResults) {
        gameState.confirmedResults = new Set();
      }

      // Get only unconfirmed results to save
      const resultsToSave = [];
      for (const [teamId, result] of gameState.results) {
        if (!gameState.confirmedResults.has(teamId)) {
          resultsToSave.push({ teamId, result });
        }
      }

      if (resultsToSave.length === 0) {
        socket.emit('error', { message: 'No new results to confirm' });
        return;
      }

      // Get game details
      const [games] = await pool.query(
        'SELECT gaming_group_id FROM games WHERE id = ?',
        [gameId]
      );
      if (games.length === 0) return;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Save only unconfirmed scores to game_scores table
        for (const { teamId, result } of resultsToSave) {
          await connection.query(`
            INSERT INTO game_scores (game_id, team_id, score)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE score = VALUES(score)
          `, [gameId, teamId, result.points]);

          // Mark as confirmed
          gameState.confirmedResults.add(teamId);
        }

        // Recalculate group scores
        await calculateGroupScores(connection, games[0].gaming_group_id);

        await connection.commit();

        // Notify all clients with confirmed team IDs
        io.to(`game:${gameId}`).emit('game:confirmed', {
          message: 'Results saved successfully',
          confirmedTeamIds: Array.from(gameState.confirmedResults)
        });

        console.log(`Game ${gameId}: ${resultsToSave.length} results confirmed and saved`);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in game:confirm:', error);
      socket.emit('error', { message: 'Failed to save results' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('Socket disconnected:', socket.id);

    if (socket.accessCodeId) {
      try {
        // Check timing mode for disconnect handling
        const gameState = activeGames.get(parseInt(socket.gameId));

        // If offline is allowed for this team, always allow reconnect
        if (socket.offlineAllowed) {
          await pool.query(`
            UPDATE team_access_codes
            SET status = 'available', socket_id = NULL, disconnected_at = NOW()
            WHERE id = ?
          `, [socket.accessCodeId]);

          io.to(`evaluator:${socket.gameId}`).emit('team:disconnected', {
            teamId: socket.teamId,
            teamName: socket.teamName,
            offlineAllowed: true
          });
        } else if (gameState && gameState.status === 'running' && socket.timingMode === 'server') {
          // Server-trust mode and not offline-allowed: kick immediately
          await pool.query(`
            UPDATE team_access_codes
            SET status = 'used', disconnected_at = NOW()
            WHERE id = ?
          `, [socket.accessCodeId]);

          io.to(`evaluator:${socket.gameId}`).emit('team:lost', {
            teamId: socket.teamId,
            teamName: socket.teamName
          });
        } else {
          // Mark as disconnected but allow reconnect
          await pool.query(`
            UPDATE team_access_codes
            SET status = 'available', socket_id = NULL, disconnected_at = NOW()
            WHERE id = ?
          `, [socket.accessCodeId]);

          io.to(`evaluator:${socket.gameId}`).emit('team:disconnected', {
            teamId: socket.teamId,
            teamName: socket.teamName
          });
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }
  });
});

// End round helper function
async function endRound(gameId) {
  const gameState = activeGames.get(parseInt(gameId));
  if (!gameState || gameState.status === 'completed' || gameState.status === 'discarded') {
    return;
  }

  // Clear any pending timeouts
  if (gameState.goTimeout) clearTimeout(gameState.goTimeout);
  if (gameState.endTimeout) clearTimeout(gameState.endTimeout);

  gameState.status = 'completed';
  gameState.phase = 'completed';

  // Get all teams with their offline status
  try {
    const [codes] = await pool.query(`
      SELECT tac.team_id, t.name as team_name, tac.offline_allowed, tac.is_selected
      FROM team_access_codes tac
      JOIN teams t ON t.id = tac.team_id
      WHERE tac.game_id = ?
    `, [gameId]);

    const results = [];
    for (const code of codes) {
      // Skip teams not selected for this round
      if (!code.is_selected) continue;

      if (gameState.results.has(code.team_id)) {
        results.push(gameState.results.get(code.team_id));
      } else if (code.offline_allowed) {
        // Offline teams without results - don't mark as timeout yet
        // They can still be captured manually or connect later
        // Skip them from results for now
        continue;
      } else {
        // Non-offline team that didn't press - timeout
        results.push({
          teamId: code.team_id,
          teamName: code.team_name,
          reactionTimeMs: gameState.maxTimeMs + 100,
          points: 0,
          timedOut: true
        });
      }
    }

    // Sort by reaction time
    results.sort((a, b) => a.reactionTimeMs - b.reactionTimeMs);

    // Broadcast results
    io.to(`game:${gameId}`).emit('game:results', { results });

    console.log(`Game ${gameId} round completed with ${results.length} results`);
  } catch (error) {
    console.error('Error in endRound:', error);
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ==================== DATABASE BACKUP & RESTORE ====================

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Cleanup function for temporary files
const cleanupTempFiles = () => {
  const tempDir = path.join(__dirname, 'temp');
  const uploadsDir = path.join(__dirname, 'uploads');

  // Clean temp directory
  if (fs.existsSync(tempDir)) {
    fs.readdir(tempDir, (err, files) => {
      if (err) {
        console.error('Error reading temp directory:', err);
        return;
      }

      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Failed to delete temp file ${file}:`, err);
          else console.log(`Cleaned up temp file: ${file}`);
        });
      });
    });
  }

  // Clean uploads directory
  if (fs.existsSync(uploadsDir)) {
    fs.readdir(uploadsDir, (err, files) => {
      if (err) {
        console.error('Error reading uploads directory:', err);
        return;
      }

      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Failed to delete upload file ${file}:`, err);
          else console.log(`Cleaned up upload file: ${file}`);
        });
      });
    });
  }
};

// Clean up temp files on startup
cleanupTempFiles();

// Schedule periodic cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// Export database as SQL in a zip file
app.get('/api/database/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gaming_dashboard_backup_${timestamp}.sql`;

    // Get database credentials
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'coaches_user';
    const dbPassword = process.env.DB_PASSWORD || 'coaches_pass';
    const dbName = process.env.DB_NAME || 'coaches_db';

    // Create temporary directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const sqlFilePath = path.join(tempDir, filename);

    // Execute mariadb-dump command (compatible with both MySQL and MariaDB)
    const dumpCommand = `mariadb-dump -h ${dbHost} -u ${dbUser} -p${dbPassword} --skip-ssl --protocol=tcp ${dbName} > "${sqlFilePath}"`;

    exec(dumpCommand, (error) => {
      if (error) {
        console.error('Database export error:', error);
        return res.status(500).json({ message: 'Failed to export database' });
      }

      // Create zip archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      const zipFilename = `gaming_dashboard_backup_${timestamp}.zip`;

      res.attachment(zipFilename);

      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ message: 'Failed to create zip archive' });
      });

      archive.on('end', () => {
        // Clean up temporary SQL file
        fs.unlink(sqlFilePath, (err) => {
          if (err) console.error('Failed to delete temp file:', err);
        });
      });

      archive.pipe(res);
      archive.file(sqlFilePath, { name: filename });
      archive.finalize();
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Failed to export database', error: error.message });
  }
});

// Import database from uploaded zip file
app.post('/api/database/import', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadedFilePath = req.file.path;
    const tempDir = path.join(__dirname, 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Check if uploaded file is a zip
    if (!req.file.originalname.endsWith('.zip')) {
      fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ message: 'Only .zip files are accepted' });
    }

    // Extract zip file
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(uploadedFilePath);
    const zipEntries = zip.getEntries();

    // Find SQL file in zip
    let sqlEntry = null;
    for (const entry of zipEntries) {
      if (entry.entryName.endsWith('.sql')) {
        sqlEntry = entry;
        break;
      }
    }

    if (!sqlEntry) {
      fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ message: 'No SQL file found in zip archive' });
    }

    // Extract SQL file
    const sqlFilePath = path.join(tempDir, sqlEntry.entryName);
    zip.extractEntryTo(sqlEntry, tempDir, false, true);

    // Get database credentials
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'coaches_user';
    const dbPassword = process.env.DB_PASSWORD || 'coaches_pass';
    const dbName = process.env.DB_NAME || 'coaches_db';

    // Execute mariadb command (compatible with both MySQL and MariaDB)
    const importCommand = `mariadb -h ${dbHost} -u ${dbUser} -p${dbPassword} --skip-ssl --protocol=tcp ${dbName} < "${sqlFilePath}"`;

    exec(importCommand, (error) => {
      // Clean up temporary files
      fs.unlink(uploadedFilePath, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
      fs.unlink(sqlFilePath, (err) => {
        if (err) console.error('Failed to delete SQL file:', err);
      });

      if (error) {
        console.error('Database import error:', error);
        return res.status(500).json({ message: 'Failed to import database', error: error.message });
      }

      res.json({ message: 'Database imported successfully' });
    });

  } catch (error) {
    console.error('Import error:', error);

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
    }

    res.status(500).json({ message: 'Failed to import database', error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});
