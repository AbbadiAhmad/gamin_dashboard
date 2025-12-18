-- Create coaches table
CREATE TABLE IF NOT EXISTS coaches (
    id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create coach_areas table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS coach_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coach_id VARCHAR(255) NOT NULL,
    area VARCHAR(50) NOT NULL,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coach_area (coach_id, area)
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coach_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_coach_areas_coach_id ON coach_areas(coach_id);
CREATE INDEX idx_requests_coach_id ON requests(coach_id);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('administrator', 'evaluator') NOT NULL DEFAULT 'evaluator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Create setup_status table to track first-time setup
CREATE TABLE IF NOT EXISTS setup_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    is_setup_complete BOOLEAN DEFAULT FALSE,
    setup_completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial setup status record
INSERT INTO setup_status (is_setup_complete) VALUES (FALSE);

-- Create gaming_groups table
CREATE TABLE IF NOT EXISTS gaming_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    show_in_dashboard BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    minimum_point INT NOT NULL DEFAULT 0,
    maximum_point INT NOT NULL DEFAULT 100,
    gaming_group_id INT NOT NULL,
    show_in_dashboard BOOLEAN DEFAULT TRUE,
    status ENUM('coming', 'running', 'past') NOT NULL DEFAULT 'coming',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (gaming_group_id) REFERENCES gaming_groups(id) ON DELETE CASCADE
);

-- Create game_scoring table
CREATE TABLE IF NOT EXISTS game_scoring (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    place_name VARCHAR(100) NOT NULL,
    place INT NOT NULL,
    score INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    UNIQUE KEY unique_game_place (game_id, place)
);

-- Create indexes for better query performance
CREATE INDEX idx_games_gaming_group_id ON games(gaming_group_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_game_scoring_game_id ON game_scoring(game_id);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create gaming_group_teams junction table (many-to-many)
CREATE TABLE IF NOT EXISTS gaming_group_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gaming_group_id INT NOT NULL,
    team_id INT NOT NULL,
    score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (gaming_group_id) REFERENCES gaming_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_team (gaming_group_id, team_id)
);

-- Create indexes
CREATE INDEX idx_gaming_group_teams_group_id ON gaming_group_teams(gaming_group_id);
CREATE INDEX idx_gaming_group_teams_team_id ON gaming_group_teams(team_id);

-- Create game_scores table to track team scores for each game
CREATE TABLE IF NOT EXISTS game_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    team_id INT NOT NULL,
    score INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_game_team (game_id, team_id)
);

-- Create indexes for game_scores
CREATE INDEX idx_game_scores_game_id ON game_scores(game_id);
CREATE INDEX idx_game_scores_team_id ON game_scores(team_id);
