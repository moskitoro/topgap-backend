const { query } = require('./db')

async function run(sql, params = []) {
  try { await query(sql, params) } catch (e) { /* columna/tabla ya existe o conflicto — ignorar */ }
}

async function setupDB() {
  // Tablas de catálogo nuevas
  await run(`CREATE TABLE IF NOT EXISTS tbl_region (
    id SERIAL PRIMARY KEY, codigo VARCHAR(10) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL, routing VARCHAR(20) NOT NULL)`)

  await run(`ALTER TABLE tbl_estado ADD COLUMN IF NOT EXISTS descripcion TEXT`)
  await run(`ALTER TABLE tbl_rol ADD COLUMN IF NOT EXISTS codigo VARCHAR(10)`)
  await run(`UPDATE tbl_rol SET codigo = UPPER(LEFT(nombre,3)) WHERE codigo IS NULL`)

  await run(`CREATE TABLE IF NOT EXISTS tbl_campeon (
    id SERIAL PRIMARY KEY, riot_id VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL, id_rol INT REFERENCES tbl_rol(id))`)

  await run(`CREATE TABLE IF NOT EXISTS tbl_usuario (
    id SERIAL PRIMARY KEY, email VARCHAR(150) UNIQUE NOT NULL,
    nombre VARCHAR(150), avatar_url TEXT, creado_en TIMESTAMP DEFAULT NOW())`)

  // Columnas nuevas en tbl_Jugador existente
  await run(`ALTER TABLE tbl_Jugador ADD COLUMN IF NOT EXISTS puuid VARCHAR(80)`)
  await run(`ALTER TABLE tbl_Jugador ADD COLUMN IF NOT EXISTS tag_line VARCHAR(20)`)
  await run(`ALTER TABLE tbl_Jugador ADD COLUMN IF NOT EXISTS id_region INT REFERENCES tbl_region(id)`)
  await run(`ALTER TABLE tbl_Jugador ADD COLUMN IF NOT EXISTS creado_en TIMESTAMP DEFAULT NOW()`)
  await run(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tbl_jugador_puuid_key')
    THEN ALTER TABLE tbl_Jugador ADD CONSTRAINT tbl_jugador_puuid_key UNIQUE (puuid); END IF;
  END $$`)

  // Tablas de análisis (nuevas)
  await run(`CREATE TABLE IF NOT EXISTS tbl_analisis (
    id SERIAL PRIMARY KEY, id_usuario INT REFERENCES tbl_usuario(id),
    titulo VARCHAR(150), creado_en TIMESTAMP DEFAULT NOW(), partidas_n INT DEFAULT 10)`)

  await run(`CREATE TABLE IF NOT EXISTS tbl_analisis_x_jugador (
    id SERIAL PRIMARY KEY,
    id_analisis INT REFERENCES tbl_analisis(id) ON DELETE CASCADE,
    id_jugador INT REFERENCES tbl_Jugador(id),
    topgap_score INT, score_linea DECIMAL(5,2), score_disciplina DECIMAL(5,2),
    score_teamfights DECIMAL(5,2), score_vision DECIMAL(5,2), kda_avg DECIMAL(6,2),
    winrate DECIMAL(5,2), kill_participation_avg DECIMAL(5,2),
    dmg_share_avg DECIMAL(5,2), vision_score_per_min DECIMAL(6,3))`)

  await run(`CREATE TABLE IF NOT EXISTS tbl_reporte (
    id SERIAL PRIMARY KEY, id_analisis INT REFERENCES tbl_analisis(id) ON DELETE CASCADE,
    ganador_id INT REFERENCES tbl_Jugador(id), diferencia INT,
    conclusion TEXT, creado_en TIMESTAMP DEFAULT NOW())`)

  // Datos base — regiones
  const regiones = [
    ['la1','Latin America North','americas'], ['la2','Latin America South','americas'],
    ['na1','North America','americas'], ['br1','Brazil','americas'],
    ['euw1','Europe West','europe'], ['eun1','Europe Nordic & East','europe'],
    ['kr','Korea','asia'], ['jp1','Japan','asia'],
  ]
  for (const [cod, nom, rou] of regiones) {
    await run(`INSERT INTO tbl_region (codigo,nombre,routing) VALUES ($1,$2,$3) ON CONFLICT (codigo) DO NOTHING`, [cod,nom,rou])
  }

  // Estados
  const estados = [['Activo','En seguimiento'],['Scouting','En evaluación'],['Fichado','Incorporado'],['Descartado','Descartado']]
  for (const [nom, desc] of estados) {
    await run(`INSERT INTO tbl_estado (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`, [nom])
    await run(`UPDATE tbl_estado SET descripcion=$1 WHERE nombre=$2 AND descripcion IS NULL`, [desc,nom])
  }

  console.log('✓ Base de datos lista (12 tablas)')
}

module.exports = { setupDB }
