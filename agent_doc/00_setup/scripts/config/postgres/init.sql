-- Wird beim ersten Start von Postgres ausgefuehrt (docker-entrypoint-initdb.d).
-- App-Datenbank (appdb/devuser) wird ueber POSTGRES_* Env-Variablen angelegt.
-- Zusaetzlich: eigene DB + User fuer SonarQube.
CREATE USER sonar WITH PASSWORD 'sonar';
CREATE DATABASE sonar OWNER sonar;
