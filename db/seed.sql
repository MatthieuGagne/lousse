INSERT INTO users (id, username, created_at) VALUES ('system', 'system', unixepoch());
INSERT INTO channels (id, name, created_by, created_at) VALUES ('general', 'general', 'system', unixepoch());
INSERT INTO channels (id, name, created_by, created_at) VALUES ('random', 'random', 'system', unixepoch());
