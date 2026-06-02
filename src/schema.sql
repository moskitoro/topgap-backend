-- ══════════════════════════════════════════════════════
--  TopGap · Schema completo · 13 tablas relacionadas
-- ══════════════════════════════════════════════════════

-- 1. Regiones (LAN, NA, KR, EUW, etc.)
CREATE TABLE IF NOT EXISTS tbl_region (
  id        SERIAL PRIMARY KEY,
  codigo    VARCHAR(10) UNIQUE NOT NULL,
  nombre    VARCHAR(50) NOT NULL,
  routing   VARCHAR(20) NOT NULL
);

-- 2. Estados de un jugador (Activo, Scouting, Fichado, Descartado)
CREATE TABLE IF NOT EXISTS tbl_estado (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE NOT NULL
);
ALTER TABLE tbl_estado ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 3. Roles en el juego
CREATE TABLE IF NOT EXISTS tbl_rol (
  id     SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  nombre VARCHAR(30) NOT NULL
);

-- 4. Parches del juego
CREATE TABLE IF NOT EXISTS tbl_parche (
  id      SERIAL PRIMARY KEY,
  version VARCHAR(10) UNIQUE NOT NULL,
  fecha   DATE NOT NULL
);

-- 5. Campeones de LoL
CREATE TABLE IF NOT EXISTS tbl_campeon (
  id        SERIAL PRIMARY KEY,
  riot_id   VARCHAR(50) UNIQUE NOT NULL,
  nombre    VARCHAR(50) NOT NULL,
  id_rol    INT REFERENCES tbl_rol(id)
);

-- 6. Usuarios de la plataforma TopGap (scouts/analistas)
CREATE TABLE IF NOT EXISTS tbl_usuario (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(150) UNIQUE NOT NULL,
  nombre     VARCHAR(150),
  avatar_url TEXT,
  creado_en  TIMESTAMP DEFAULT NOW()
);

-- 7. Jugadores bajo scouting
CREATE TABLE IF NOT EXISTS tbl_jugador (
  id         SERIAL PRIMARY KEY,
  puuid      VARCHAR(80) UNIQUE NOT NULL,
  game_name  VARCHAR(80) NOT NULL,
  tag_line   VARCHAR(20) NOT NULL,
  nivel      INT DEFAULT 1,
  creado_en  TIMESTAMP DEFAULT NOW()
);
ALTER TABLE tbl_jugador ADD COLUMN IF NOT EXISTS id_region INT REFERENCES tbl_region(id);
ALTER TABLE tbl_jugador ADD COLUMN IF NOT EXISTS id_estado INT REFERENCES tbl_estado(id);

-- 8. Partidas
CREATE TABLE IF NOT EXISTS tbl_partida (
  id              SERIAL PRIMARY KEY,
  riot_match_id   VARCHAR(50) UNIQUE NOT NULL,
  id_parche       INT REFERENCES tbl_parche(id),
  modo_juego      VARCHAR(30),
  duracion_seg    INT,
  fecha_partida   TIMESTAMP
);

-- 9. Estadísticas por jugador por partida
CREATE TABLE IF NOT EXISTS tbl_jugador_x_partida (
  id                   SERIAL PRIMARY KEY,
  id_jugador           INT REFERENCES tbl_jugador(id) ON DELETE CASCADE,
  id_partida           INT REFERENCES tbl_partida(id) ON DELETE CASCADE,
  id_rol               INT REFERENCES tbl_rol(id),
  id_campeon           INT REFERENCES tbl_campeon(id),
  kills                INT DEFAULT 0,
  deaths               INT DEFAULT 0,
  assists              INT DEFAULT 0,
  cs                   INT DEFAULT 0,
  oro                  INT DEFAULT 0,
  danio                INT DEFAULT 0,
  vision_score         INT DEFAULT 0,
  kda                  DECIMAL(6,2),
  participacion_kills  DECIMAL(5,2),
  win                  BOOLEAN DEFAULT FALSE
);

-- 10. Sesiones de análisis (cada vez que se comparan dos jugadores)
CREATE TABLE IF NOT EXISTS tbl_analisis (
  id           SERIAL PRIMARY KEY,
  id_usuario   INT REFERENCES tbl_usuario(id),
  titulo       VARCHAR(150),
  creado_en    TIMESTAMP DEFAULT NOW(),
  partidas_n   INT DEFAULT 10
);

-- 11. Jugadores incluidos en un análisis con su score calculado
CREATE TABLE IF NOT EXISTS tbl_analisis_x_jugador (
  id                        SERIAL PRIMARY KEY,
  id_analisis               INT REFERENCES tbl_analisis(id) ON DELETE CASCADE,
  id_jugador                INT REFERENCES tbl_jugador(id),
  topgap_score              INT,
  score_linea               DECIMAL(5,2),
  score_disciplina          DECIMAL(5,2),
  score_teamfights          DECIMAL(5,2),
  score_vision              DECIMAL(5,2),
  kda_avg                   DECIMAL(6,2),
  winrate                   DECIMAL(5,2),
  kill_participation_avg    DECIMAL(5,2),
  dmg_share_avg             DECIMAL(5,2),
  vision_score_per_min      DECIMAL(6,3)
);

-- 12. Reportes finales con conclusión textual del análisis
CREATE TABLE IF NOT EXISTS tbl_reporte (
  id            SERIAL PRIMARY KEY,
  id_analisis   INT REFERENCES tbl_analisis(id) ON DELETE CASCADE,
  ganador_id    INT REFERENCES tbl_jugador(id),
  diferencia    INT,
  conclusion    TEXT,
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- 13. Tier/Rango competitivo del jugador
CREATE TABLE IF NOT EXISTS tbl_tier (
  id            SERIAL PRIMARY KEY,
  id_jugador    INT REFERENCES tbl_jugador(id) ON DELETE CASCADE,
  liga          VARCHAR(20) NOT NULL,  -- IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER
  division      VARCHAR(5),            -- I, II, III, IV (NULL para Master+)
  lp            INT DEFAULT 0,
  victorias     INT DEFAULT 0,
  derrotas      INT DEFAULT 0,
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- ── Datos base ────────────────────────────────────────────────────────────────

INSERT INTO tbl_region (codigo, nombre, routing) VALUES
  ('la1',  'Latin America North', 'americas'),
  ('la2',  'Latin America South', 'americas'),
  ('na1',  'North America',       'americas'),
  ('br1',  'Brazil',              'americas'),
  ('euw1', 'Europe West',         'europe'),
  ('eun1', 'Europe Nordic & East','europe'),
  ('kr',   'Korea',               'asia'),
  ('jp1',  'Japan',               'asia')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tbl_estado (nombre, descripcion) VALUES
  ('Activo',     'Jugador en seguimiento activo'),
  ('Scouting',   'En proceso de evaluación'),
  ('Fichado',    'Incorporado al equipo'),
  ('Descartado', 'Evaluación negativa')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tbl_rol (codigo, nombre) VALUES
  ('TOP', 'Top Lane'),
  ('JG',  'Jungle'),
  ('MID', 'Mid Lane'),
  ('ADC', 'Bot Lane'),
  ('SUP', 'Support')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tbl_parche (version, fecha) VALUES
  ('14.10', '2024-05-15'),
  ('14.11', '2024-05-29'),
  ('14.12', '2024-06-12'),
  ('14.23', '2024-11-20'),
  ('25.01', '2025-01-08')
ON CONFLICT (version) DO NOTHING;
