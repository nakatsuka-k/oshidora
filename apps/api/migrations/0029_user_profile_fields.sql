-- User profile fields for end-users (push profile edit/registration to DB)

ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN full_name_kana TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN birth_date TEXT NOT NULL DEFAULT '';
-- JSON array string of genre labels (multi-select)
ALTER TABLE users ADD COLUMN favorite_genres_json TEXT NOT NULL DEFAULT '[]';
