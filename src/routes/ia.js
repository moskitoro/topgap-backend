const express = require('express')
const router = express.Router()
const { query } = require('../db')
const { analizarConIA } = require('../gemini')

// ─── ENDPOINT 9 · GET /api/analisis/:id/ia ── LÓGICA COMPLEJA ─────────────────
// Llama a Gemini AI con las métricas del análisis y devuelve interpretación
// en lenguaje natural para el scout/analista
router.get('/:id/ia', async (req, res) => {
  try {
    const { id } = req.params

    const jugadores = await query(`
      SELECT axj.*, j.game_name, r.codigo as region, r.nombre as region_nombre
      FROM tbl_analisis_x_jugador axj
      JOIN tbl_jugador j ON axj.id_jugador = j.id
      JOIN tbl_region r  ON j.id_region = r.id
      WHERE axj.id_analisis = $1
      ORDER BY axj.topgap_score DESC
    `, [id])

    if (jugadores.rows.length < 2)
      return res.status(400).json({ ok: false, error: 'Análisis incompleto' })

    const [j1, j2] = jugadores.rows

    const iaResult = await analizarConIA({
      jugador1: {
        nombre: j1.game_name, region: j1.region,
        topgap_score: j1.topgap_score, score_linea: j1.score_linea,
        score_disciplina: j1.score_disciplina, score_teamfights: j1.score_teamfights,
        score_vision: j1.score_vision, kda_avg: j1.kda_avg,
        winrate: j1.winrate, kill_participation_avg: j1.kill_participation_avg,
      },
      jugador2: {
        nombre: j2.game_name, region: j2.region,
        topgap_score: j2.topgap_score, score_linea: j2.score_linea,
        score_disciplina: j2.score_disciplina, score_teamfights: j2.score_teamfights,
        score_vision: j2.score_vision, kda_avg: j2.kda_avg,
        winrate: j2.winrate, kill_participation_avg: j2.kill_participation_avg,
      }
    })

    // Guardar en el reporte existente
    await query(
      `UPDATE tbl_reporte SET conclusion = $1 WHERE id_analisis = $2`,
      [iaResult.resumen, id]
    ).catch(() => {})

    res.json({ ok: true, data: iaResult })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
