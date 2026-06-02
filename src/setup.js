const { query } = require('./db')

async function run(sql, params = []) {
  try { await query(sql, params) } catch (e) {
    if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
      console.warn('Setup warning:', e.message.substring(0, 80))
    }
  }
}

async function setupDB() {
  // 1. Regiones
  await run(`CREATE TABLE IF NOT EXISTS tbl_region (
    id SERIAL PRIMARY KEY, codigo VARCHAR(10) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL, routing VARCHAR(20) NOT NULL)`)

  // 2. Estados
  await run(`CREATE TABLE IF NOT EXISTS tbl_estado (
    id SERIAL PRIMARY KEY, nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT)`)

  // 3. Roles
  await run(`CREATE TABLE IF NOT EXISTS tbl_rol (
    id SERIAL PRIMARY KEY, codigo VARCHAR(10) UNIQUE NOT NULL,
    nombre VARCHAR(30) NOT NULL)`)

  // 4. Parches
  await run(`CREATE TABLE IF NOT EXISTS tbl_parche (
    id SERIAL PRIMARY KEY, version VARCHAR(10) UNIQUE NOT NULL,
    fecha DATE)`)

  // 5. Campeones
  await run(`CREATE TABLE IF NOT EXISTS tbl_campeon (
    id SERIAL PRIMARY KEY, riot_id VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL, id_rol INT REFERENCES tbl_rol(id))`)

  // 6. Usuarios de la plataforma
  await run(`CREATE TABLE IF NOT EXISTS tbl_usuario (
    id SERIAL PRIMARY KEY, email VARCHAR(150) UNIQUE NOT NULL,
    nombre VARCHAR(150), avatar_url TEXT, creado_en TIMESTAMP DEFAULT NOW())`)

  // 7. Jugadores
  await run(`CREATE TABLE IF NOT EXISTS tbl_jugador (
    id SERIAL PRIMARY KEY, puuid VARCHAR(80) UNIQUE,
    game_name VARCHAR(80) NOT NULL, tag_line VARCHAR(20),
    id_region INT REFERENCES tbl_region(id),
    id_estado INT REFERENCES tbl_estado(id),
    nivel INT DEFAULT 1, creado_en TIMESTAMP DEFAULT NOW())`)

  // 8. Partidas
  await run(`CREATE TABLE IF NOT EXISTS tbl_partida (
    id SERIAL PRIMARY KEY, riot_match_id VARCHAR(50) UNIQUE NOT NULL,
    id_parche INT REFERENCES tbl_parche(id),
    modo_juego VARCHAR(30), duracion_seg INT, fecha_partida TIMESTAMP)`)

  // 9. Jugador x Partida
  await run(`CREATE TABLE IF NOT EXISTS tbl_jugador_x_partida (
    id SERIAL PRIMARY KEY,
    id_jugador INT REFERENCES tbl_jugador(id) ON DELETE CASCADE,
    id_partida INT REFERENCES tbl_partida(id) ON DELETE CASCADE,
    id_rol INT REFERENCES tbl_rol(id),
    id_campeon INT REFERENCES tbl_campeon(id),
    kills INT DEFAULT 0, deaths INT DEFAULT 0, assists INT DEFAULT 0,
    cs INT DEFAULT 0, oro INT DEFAULT 0, danio INT DEFAULT 0,
    vision_score INT DEFAULT 0, kda DECIMAL(6,2),
    participacion_kills DECIMAL(5,2), win BOOLEAN DEFAULT FALSE)`)

  // 10. Análisis
  await run(`CREATE TABLE IF NOT EXISTS tbl_analisis (
    id SERIAL PRIMARY KEY, id_usuario INT REFERENCES tbl_usuario(id),
    titulo VARCHAR(150), creado_en TIMESTAMP DEFAULT NOW(), partidas_n INT DEFAULT 10)`)

  // 11. Análisis x Jugador
  await run(`CREATE TABLE IF NOT EXISTS tbl_analisis_x_jugador (
    id SERIAL PRIMARY KEY,
    id_analisis INT REFERENCES tbl_analisis(id) ON DELETE CASCADE,
    id_jugador INT REFERENCES tbl_jugador(id),
    topgap_score INT, score_linea DECIMAL(5,2), score_disciplina DECIMAL(5,2),
    score_teamfights DECIMAL(5,2), score_vision DECIMAL(5,2),
    kda_avg DECIMAL(6,2), winrate DECIMAL(5,2),
    kill_participation_avg DECIMAL(5,2), dmg_share_avg DECIMAL(5,2),
    vision_score_per_min DECIMAL(6,3))`)

  // 12. Reportes
  await run(`CREATE TABLE IF NOT EXISTS tbl_reporte (
    id SERIAL PRIMARY KEY,
    id_analisis INT REFERENCES tbl_analisis(id) ON DELETE CASCADE,
    ganador_id INT REFERENCES tbl_jugador(id),
    diferencia INT, conclusion TEXT, creado_en TIMESTAMP DEFAULT NOW())`)

  // Datos base
  const regiones = [
    ['la1','Latin America North','americas'], ['la2','Latin America South','americas'],
    ['na1','North America','americas'], ['br1','Brazil','americas'],
    ['euw1','Europe West','europe'], ['eun1','Europe Nordic & East','europe'],
    ['kr','Korea','asia'], ['jp1','Japan','asia'],
  ]
  for (const [c, n, r] of regiones)
    await run(`INSERT INTO tbl_region (codigo,nombre,routing) VALUES ($1,$2,$3) ON CONFLICT (codigo) DO NOTHING`, [c,n,r])

  const estados = [['Activo','En seguimiento activo'],['Scouting','En evaluación'],['Fichado','Incorporado al equipo'],['Descartado','Descartado']]
  for (const [n, d] of estados)
    await run(`INSERT INTO tbl_estado (nombre,descripcion) VALUES ($1,$2) ON CONFLICT (nombre) DO NOTHING`, [n,d])

  const roles = [['TOP','Top Lane'],['JG','Jungle'],['MID','Mid Lane'],['ADC','Bot Lane'],['SUP','Support']]
  for (const [c, n] of roles)
    await run(`INSERT INTO tbl_rol (codigo,nombre) VALUES ($1,$2) ON CONFLICT (codigo) DO NOTHING`, [c,n])

  const parches = [['14.10','2024-05-15'],['14.23','2024-11-20'],['25.01','2025-01-08']]
  for (const [v, f] of parches)
    await run(`INSERT INTO tbl_parche (version,fecha) VALUES ($1,$2) ON CONFLICT (version) DO NOTHING`, [v,f])

  console.log('✓ Base de datos lista (12 tablas)')
}

module.exports = { setupDB }
