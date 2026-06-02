const express = require('express')
const router = express.Router()
const { query } = require('../db')
const { buscarEnRiot } = require('../riot')

// ─── ENDPOINT 1 · GET /jugadores ─────────────────────────────────────────────
// Lista todos los jugadores registrados con su estado y región
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT j.id, j.game_name, j.tag_line, j.nivel,
             r.codigo as region, r.nombre as region_nombre,
             e.nombre as estado
      FROM tbl_jugador j
      JOIN tbl_region r ON j.id_region = r.id
      JOIN tbl_estado e ON j.id_estado = e.id
      ORDER BY j.creado_en DESC
    `)
    res.json({ ok: true, data: result.rows })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── ENDPOINT 2 · GET /jugadores/:id ─────────────────────────────────────────
// Detalle de un jugador con su última métrica guardada
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const jugador = await query(`
      SELECT j.*, r.codigo as region_codigo, r.routing, e.nombre as estado_nombre
      FROM tbl_jugador j
      JOIN tbl_region r ON j.id_region = r.id
      JOIN tbl_estado e ON j.id_estado = e.id
      WHERE j.id = $1
    `, [id])

    if (!jugador.rows.length) return res.status(404).json({ ok: false, error: 'Jugador no encontrado' })

    const metricas = await query(`
      SELECT axj.*
      FROM tbl_analisis_x_jugador axj
      JOIN tbl_analisis a ON axj.id_analisis = a.id
      WHERE axj.id_jugador = $1
      ORDER BY a.creado_en DESC
      LIMIT 1
    `, [id])

    res.json({ ok: true, data: { ...jugador.rows[0], ultima_metrica: metricas.rows[0] || null } })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── ENDPOINT 3 · POST /jugadores ─────────────────────────────────────────────
// Registra o encuentra un jugador por RiotID
router.post('/', async (req, res) => {
  try {
    const { riotId, region } = req.body
    if (!riotId || !region) return res.status(400).json({ ok: false, error: 'riotId y region son requeridos' })

    const regionRow = await query('SELECT * FROM tbl_region WHERE codigo = $1', [region])
    if (!regionRow.rows.length) return res.status(400).json({ ok: false, error: 'Región inválida' })

    const [gameName, tagLine] = riotId.includes('#') ? riotId.split('#') : [riotId, region.toUpperCase()]

    // Buscar en Riot API
    const cuenta = await buscarEnRiot(gameName, tagLine, regionRow.rows[0].routing)

    // Upsert en BD
    const estadoActivo = await query("SELECT id FROM tbl_estado WHERE nombre = 'Activo' LIMIT 1")
    const result = await query(`
      INSERT INTO tbl_jugador (puuid, game_name, tag_line, id_region, id_estado)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (puuid) DO UPDATE SET game_name = $2, tag_line = $3
      RETURNING *
    `, [cuenta.puuid, cuenta.gameName, cuenta.tagLine, regionRow.rows[0].id, estadoActivo.rows[0].id])

    res.json({ ok: true, data: result.rows[0] })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── ENDPOINT 4 · GET /jugadores/:id/historial ── LÓGICA COMPLEJA ─────────────
// Historial de análisis del jugador con evolución de su TopGap Score
// Incluye: tendencia, mejor y peor score, promedio, comparación vs rivales
router.get('/:id/historial', async (req, res) => {
  try {
    const { id } = req.params

    const historial = await query(`
      SELECT
        a.creado_en,
        a.partidas_n,
        axj.topgap_score,
        axj.score_linea,
        axj.score_disciplina,
        axj.score_teamfights,
        axj.score_vision,
        axj.kda_avg,
        axj.winrate,
        axj.kill_participation_avg,
        -- Rival en ese análisis
        j2.game_name  AS rival_nombre,
        axj2.topgap_score AS rival_score
      FROM tbl_analisis_x_jugador axj
      JOIN tbl_analisis a         ON axj.id_analisis = a.id
      JOIN tbl_jugador j          ON axj.id_jugador = j.id
      -- Buscar el otro jugador del mismo análisis
      LEFT JOIN tbl_analisis_x_jugador axj2 ON axj2.id_analisis = a.id AND axj2.id_jugador != $1
      LEFT JOIN tbl_jugador j2             ON j2.id = axj2.id_jugador
      WHERE axj.id_jugador = $1
      ORDER BY a.creado_en DESC
    `, [id])

    if (!historial.rows.length) return res.json({ ok: true, data: { partidas: [], resumen: null } })

    // Calcular tendencia y estadísticas agregadas
    const scores = historial.rows.map(r => r.topgap_score)
    const promedio = Math.round(scores.reduce((a, b) => a + Number(b), 0) / scores.length)
    const mejor   = Math.max(...scores)
    const peor    = Math.min(...scores)
    const victorias = historial.rows.filter(r => r.rival_score && r.topgap_score > r.rival_score).length
    const tendencia = scores.length >= 2
      ? (scores[0] > scores[scores.length - 1] ? 'mejorando' : scores[0] < scores[scores.length - 1] ? 'bajando' : 'estable')
      : 'insuficiente'

    res.json({
      ok: true,
      data: {
        partidas: historial.rows,
        resumen: { promedio, mejor, peor, total_analisis: scores.length, victorias, tendencia }
      }
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── ENDPOINT 5 · PATCH /jugadores/:id/estado ─────────────────────────────────
// Actualiza el estado de un jugador (Activo, Scouting, Fichado, Descartado)
router.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params
    const { estado } = req.body
    const estadoRow = await query('SELECT id FROM tbl_estado WHERE nombre = $1', [estado])
    if (!estadoRow.rows.length) return res.status(400).json({ ok: false, error: 'Estado inválido' })

    await query('UPDATE tbl_jugador SET id_estado = $1 WHERE id = $2', [estadoRow.rows[0].id, id])
    res.json({ ok: true, message: `Estado actualizado a "${estado}"` })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
