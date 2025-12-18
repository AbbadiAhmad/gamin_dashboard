const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '2h'; // Token expires in 2 hours

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'coaches_user',
  password: process.env.DB_PASSWORD || 'coaches_pass',
  database: process.env.DB_NAME || 'coaches_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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
    res.json(groups);
  } catch (error) {
    console.error('Error fetching gaming groups:', error);
    res.status(500).json({ message: 'Failed to fetch gaming groups' });
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

    const { name, description } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO gaming_groups (name, description) VALUES (?, ?)',
      [name, description || '']
    );

    res.status(201).json({
      id: result.insertId,
      name,
      description: description || ''
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
    const { name, description } = req.body;

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
      'UPDATE gaming_groups SET name = ?, description = ? WHERE id = ?',
      [name, description || '', id]
    );

    res.json({
      id: parseInt(id),
      name,
      description: description || ''
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

// Get all games
app.get('/games', authenticateToken, async (req, res) => {
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

// Get a specific game
app.get('/games/:id', authenticateToken, async (req, res) => {
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

    const { name, description, minimumPoint, maximumPoint, gamingGroupId, showInDashboard, status, scoring } = req.body;

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
      `INSERT INTO games (name, description, minimum_point, maximum_point, gaming_group_id, show_in_dashboard, status, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || '', minimumPoint || 0, maximumPoint || 100, gamingGroupId, showInDashboard !== false, status || 'coming', displayOrder]
    );

    const gameId = result.insertId;

    // Insert default scoring if not provided
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
      scoring: scoringData
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
    const { name, description, minimumPoint, maximumPoint, gamingGroupId, showInDashboard, status, scoring } = req.body;

    // Validate input
    if (!name || !gamingGroupId) {
      await connection.rollback();
      return res.status(400).json({ message: 'Name and gaming group are required' });
    }

    // Check if game exists
    const [existingGame] = await connection.query('SELECT id FROM games WHERE id = ?', [id]);
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
           gaming_group_id = ?, show_in_dashboard = ?, status = ?
       WHERE id = ?`,
      [name, description || '', minimumPoint || 0, maximumPoint || 100, gamingGroupId, showInDashboard !== false, status || 'coming', id]
    );

    // Update scoring if provided
    if (scoring && scoring.length > 0) {
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});
