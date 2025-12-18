-- Sample Data Script for Gaming Dashboard
-- 3 Gaming Groups, 5 Teams, Games with different statuses and scores

-- Clear existing data (in reverse order of dependencies)
DELETE FROM game_scores;
DELETE FROM game_scoring;
DELETE FROM games;
DELETE FROM gaming_group_teams;
DELETE FROM teams;
DELETE FROM gaming_groups;

-- Insert 3 Gaming Groups
INSERT INTO gaming_groups (id, name, description, show_in_dashboard) VALUES
(1, 'Summer Championship 2024', 'Competitive summer league with multiple challenges', TRUE),
(2, 'Weekly Challenges', 'Fast-paced weekly mini-games and competitions', TRUE),
(3, 'Elite Tournament Series', 'Premium tournament series for top performers', TRUE);

-- Insert 5 Teams
INSERT INTO teams (id, name, description) VALUES
(1, 'Team 1', 'Fast and fierce competitors'),
(2, 'Team 2', 'Legendary team with strong tactics'),
(3, 'Team 3', 'Rising stars of the competition'),
(4, 'Team 4', 'Unpredictable and dynamic players'),
(5, 'Team 5', 'Masters of strategic gameplay');

-- Assign all teams to all gaming groups with initial scores
INSERT INTO gaming_group_teams (gaming_group_id, team_id, score) VALUES
-- Group 1: Summer Championship
(1, 1, 0), (1, 2, 0), (1, 3, 0), (1, 4, 0), (1, 5, 0),
-- Group 2: Weekly Challenges
(2, 1, 0), (2, 2, 0), (2, 3, 0), (2, 4, 0), (2, 5, 0),
-- Group 3: Elite Tournament
(3, 1, 0), (3, 2, 0), (3, 3, 0), (3, 4, 0), (3, 5, 0);

-- ===========================================
-- GROUP 1: Summer Championship (2 games)
-- ===========================================

-- Game 1: Past game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(1, 1, 'Speed Challenge', 'Complete tasks as fast as possible', 'past', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(1, '1st Place', 1, 10),
(1, '2nd Place', 2, 7),
(1, '3rd Place', 3, 5),
(1, '4th Place', 4, 3),
(1, 'Other', -1, 1);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(1, 2, 95), -- 
(1, 1, 88), -- 
(1, 5, 82), -- 
(1, 3, 75), -- 
(1, 4, 68); -- 

-- Game 2: Running game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(2, 1, 'Strategy Battle', 'Tactical team-based competition', 'running', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(2, '1st Place', 1, 10),
(2, '2nd Place', 2, 7),
(2, '3rd Place', 3, 5),
(2, '4th Place', 4, 3),
(2, 'Other', -1, 1);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(2, 3, 78), -- 
(2, 1, 72), -- 
(2, 4, 65); -- 

-- ===========================================
-- GROUP 2: Weekly Challenges (5 games)
-- ===========================================

-- Game 3: Past game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(3, 2, 'Quick Reflex Challenge', 'Test your reaction time', 'past', 0, 50);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(3, '1st Place', 1, 8),
(3, '2nd Place', 2, 5),
(3, '3rd Place', 3, 3),
(3, '4th Place', 4, 2),
(3, 'Other', -1, 1);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(3, 4, 48), -- 
(3, 2, 45), -- 
(3, 1, 42), -- 
(3, 5, 38), -- 
(3, 3, 35); -- 

-- Game 4: Running game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(4, 2, 'Memory Master', 'Remember and recall complex patterns', 'running', 0, 50);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(4, '1st Place', 1, 8),
(4, '2nd Place', 2, 5),
(4, '3rd Place', 3, 3),
(4, '4th Place', 4, 2),
(4, 'Other', -1, 1);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(4, 5, 45), -- 
(4, 3, 40), -- 
(4, 2, 38); -- 

-- Game 5: Running game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(5, 2, 'Puzzle Sprint', 'Solve puzzles under time pressure', 'running', 0, 50);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(5, '1st Place', 1, 8),
(5, '2nd Place', 2, 5),
(5, '3rd Place', 3, 3),
(5, '4th Place', 4, 2),
(5, 'Other', -1, 1);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(5, 1, 42), -- 
(5, 4, 39), --
(5, 2, 35); -- 

-- Game 6: Upcoming game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(6, 2, 'Team Coordination', 'Work together to achieve goals', 'coming', 0, 50);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(6, '1st Place', 1, 8),
(6, '2nd Place', 2, 5),
(6, '3rd Place', 3, 3),
(6, '4th Place', 4, 2),
(6, 'Other', -1, 1);

-- Game 7: Upcoming game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(7, 2, 'Final Showdown', 'Ultimate challenge combining all skills', 'coming', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(7, '1st Place', 1, 15),
(7, '2nd Place', 2, 10),
(7, '3rd Place', 3, 7),
(7, '4th Place', 4, 4),
(7, 'Other', -1, 2);

-- ===========================================
-- GROUP 3: Elite Tournament (7 games)
-- ===========================================

-- Game 8: Past game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(8, 3, 'Elite Qualifier Round 1', 'First elimination round', 'past', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(8, '1st Place', 1, 12),
(8, '2nd Place', 2, 9),
(8, '3rd Place', 3, 6),
(8, '4th Place', 4, 4),
(8, 'Other', -1, 2);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(8, 5, 92), -- 
(8, 3, 88), -- 
(8, 2, 85), -- 
(8, 1, 79), -- 
(8, 4, 72); -- 

-- Game 9: Running game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(9, 3, 'Elite Qualifier Round 2', 'Second elimination round', 'running', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(9, '1st Place', 1, 12),
(9, '2nd Place', 2, 9),
(9, '3rd Place', 3, 6),
(9, '4th Place', 4, 4),
(9, 'Other', -1, 2);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(9, 1, 85), -- 
(9, 5, 82), -- 
(9, 3, 78), -- 
(9, 2, 75); -- 

-- Game 10: Running game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(10, 3, 'Skill Assessment', 'Comprehensive skills evaluation', 'running', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(10, '1st Place', 1, 12),
(10, '2nd Place', 2, 9),
(10, '3rd Place', 3, 6),
(10, '4th Place', 4, 4),
(10, 'Other', -1, 2);

INSERT INTO game_scores (game_id, team_id, score) VALUES
(10, 2, 88), -- 
(10, 4, 85), -- 
(10, 3, 80); -- 

-- Game 11: Upcoming game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(11, 3, 'Semi-Finals', 'Top teams compete for finals', 'coming', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(11, '1st Place', 1, 12),
(11, '2nd Place', 2, 9),
(11, '3rd Place', 3, 6),
(11, '4th Place', 4, 4),
(11, 'Other', -1, 2);

-- Game 12: Upcoming game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(12, 3, 'Grand Finals Prep', 'Preparation round for finals', 'coming', 0, 100);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(12, '1st Place', 1, 12),
(12, '2nd Place', 2, 9),
(12, '3rd Place', 3, 6),
(12, '4th Place', 4, 4),
(12, 'Other', -1, 2);

-- Game 13: Upcoming game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(13, 3, 'Elite Championship', 'Final championship match', 'coming', 0, 150);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(13, '1st Place', 1, 20),
(13, '2nd Place', 2, 15),
(13, '3rd Place', 3, 10),
(13, '4th Place', 4, 6),
(13, 'Other', -1, 3);

-- Game 14: Upcoming game
INSERT INTO games (id, gaming_group_id, name, description, status, minimum_point, maximum_point) VALUES
(14, 3, 'Bonus Challenge', 'Special bonus round for extra points', 'coming', 0, 75);

INSERT INTO game_scoring (game_id, place_name, place, score) VALUES
(14, '1st Place', 1, 12),
(14, '2nd Place', 2, 9),
(14, '3rd Place', 3, 6),
(14, '4th Place', 4, 4),
(14, 'Other', -1, 2);

-- Reset auto-increment counters
ALTER TABLE gaming_groups AUTO_INCREMENT = 4;
ALTER TABLE teams AUTO_INCREMENT = 6;
ALTER TABLE games AUTO_INCREMENT = 15;

-- Display summary
SELECT 'Sample data created successfully!' AS Status;
SELECT COUNT(*) AS 'Gaming Groups' FROM gaming_groups;
SELECT COUNT(*) AS 'Teams' FROM teams;
SELECT COUNT(*) AS 'Games' FROM games;
SELECT COUNT(*) AS 'Game Scores' FROM game_scores;
SELECT status, COUNT(*) AS count FROM games GROUP BY status;
