-- The four-look picker plus the two custom prompts, and how a session was opened.
ALTER TABLE projects ADD COLUMN look TEXT;
ALTER TABLE projects ADD COLUMN start_mode TEXT;
ALTER TABLE projects ADD COLUMN build_prompt TEXT;
ALTER TABLE projects ADD COLUMN style_prompt TEXT;
ALTER TABLE sessions ADD COLUMN via TEXT;
