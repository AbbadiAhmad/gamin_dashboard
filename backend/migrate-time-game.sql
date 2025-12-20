-- Migration script for time-based game features
-- Run this script to add offline mode, team selection, and event log support

-- Add offline_allowed column to team_access_codes if it doesn't exist
ALTER TABLE team_access_codes
ADD COLUMN IF NOT EXISTS offline_allowed BOOLEAN DEFAULT FALSE;

-- Add is_selected column to team_access_codes if it doesn't exist
ALTER TABLE team_access_codes
ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT TRUE;

-- Create game_event_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS game_event_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    actor VARCHAR(100) NOT NULL,
    actor_type ENUM('evaluator', 'team', 'system') DEFAULT 'system',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Add index for faster queries on game_id
CREATE INDEX IF NOT EXISTS idx_event_log_game_id ON game_event_log(game_id);
