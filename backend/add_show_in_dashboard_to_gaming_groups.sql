-- Add show_in_dashboard column to gaming_groups table if it doesn't exist
ALTER TABLE gaming_groups 
ADD COLUMN IF NOT EXISTS show_in_dashboard BOOLEAN DEFAULT FALSE AFTER description;
