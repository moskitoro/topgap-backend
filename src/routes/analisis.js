const express = require('express')
const router = express.Router()
const { query } = require('../db')
const { obtenerMetricasJugador } = require('../riot')

// ─── ENDPOINT 6 · POST /analisis ── LÓGICA COMPLEJA ───────────────────────────
// Crea un análisis completo: llama a Riot API, calcula TopGap Score,
// guarda jugadores, métricas y reporte en la BD
router.post('/', async (req, res) => {
  try {
    const { riotId1, region1, riotId2, region2, emailUsuario } = req.body
    if (!riotId1 || !riotId2) return res.status(400).json({ ok: false, error: 'Se requieren dos jugadores' })

    // 1. Obtener o crear usuario
    let usuario = await query('SELECT id FROM tbl_usuario WHERE email = $1', [emailUsuario || 'anonimo@topgap.app'])
    if (!usuario.rows.length) {
      usuario = await query(
        'INSERT INTO tbl_usuario (email, nombre) VALUES ($1, $2) RETURNING id',
        [emailUsuario || 'anonimo@topgap.app', 'Analista']
      )
    }
    const idUsuario = usuario.rows[0].id

    // 2. Fetch Riot API para ambos jugadores en paralelo
    const [data1, data2] = await Promise.all([
      obtenerMetricasJugador(riotId1, region1),
      obtenerMetricasJugador(riotId2, region2),
    ])

    if (data1.error) return res.status(400).json({ ok: false, error: `Jugador 1: ${data1.error}` })
    if (data2.error) return res.status(400).json({ ok: false, error: `Jugador 2: ${data2.error}` })

    // 3. Upsert jugadores en BD
    const upsertJugador = async (data, regionCodigo) => {
      const regionRow = await query('SELECT id FROM tbl_region WHERE codigo = $1', [regionCodigo])
      const estadoRow = await query("SELECT id FROM tbl_estado WHERE nombre = 'Scouting' LIMIT 1")
      const r = await query(`
        INSERT INTO tbl_jugador (puuid, game_name, tag_line, id_region, id_estado)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (puuid) DO UPDATE SET game_name = $2, tag_line = $3
        RETURNING id
      `, [data.puuid, data.gameName, data.tagLine, regionRow.rows[0].id, estadoRow.rows[0].id])
      return r.rows[0].id
    }

    const [idJ1, idJ2] = await Promise.all([
      upsertJugador(data1, region1),
      upsertJugador(data2, region2),
    ])

    // 4. Crear sesión de análisis
    const titulo = `${data1.gameName} vs ${data2.gameName}`
    const partidasN = Math.min(data1.partidasAnalizadas || 10, data2.partidasAnalizadas || 10)
    const analisis = await query(
      'INSERT INTO tbl_analisis (id_usuario, titulo, partidas_n) VALUES ($1, $2, $3) RETURNING id',
      [idUsuario, titulo, partidasN]
    )
    const idAnalisis = analisis.rows[0].id

    // 5. Guardar métricas de ambos jugadores
    const insertMetrica = async (idJugador, metricas) => {
      await query(`
        INSERT INTO tbl_analisis_x_jugador
          (id_analisis, id_jugador, topgap_score, score_linea, score_disciplina,
           score_teamfights, score_vision, kda_avg, winrate, kill_participation_avg, dmg_share_avg, vision_score_per_min)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        idAnalisis, idJugador,
        metricas.topgapScore,
        metricas.scoreLinea, metricas.scoreDisciplina,
        metricas.scoreTeamfights, metricas.scoreVision,
        metricas.kdaAvg, metricas.winrate,
        metricas.killParticipationAvg, metricas.dmgShareAvg,
        metricas.visionScorePerMin
      ])
    }

    await Promise.all([
      insertMetrica(idJ1, data1.metricas),
      insertMetrica(idJ2, data2.metricas),
    ])

    // 6. Generar conclusión automática y guardar reporte
    const ganadorId = data1.metricas.topgapScore >= data2.metricas.topgapScore ? idJ1 : idJ2
    const diferencia = Math.abs(data1.metricas.topgapScore - data2.metricas.topgapScore)
    const ganadorNombre = ganadorId === idJ1 ? data1.gameName : data2.gameName
    const perdedorNombre = ganadorId === idJ1 ? data2.gameName : data1.gameName

    const conclusion = generarConclusion(
      ganadorNombre, perdedorNombre, diferencia,
      ganadorId === idJ1 ? data1.metricas : data2.metricas,
      ganadorId === idJ1 ? data2.metricas : data1.metricas
    )

    await query(
      'INSERT INTO tbl_reporte (id_analisis, ganador_id, diferencia, conclusion) VALUES ($1,$2,$3,$4)',
      [idAnalisis, ganadorId, diferencia, conclusion]
    )

    res.json({
      ok: true,
      data: {
        id: idAnalisis,
        titulo,
        jugador1: { ...data1, id: idJ1 },
        jugador2: { ...data2, id: idJ2 },
        ganador: ganadorNombre,
        diferencia,
        conclusion
      }
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── ENDPOINT 7 · GET /analisis ───────────────────────────────────────────────
// Lista análisis del usuario autenticado (filtrado por email)
router.get('/', async (req, res) => {
  try {
    const { email } = req.query
    if (!email) return res.json({ ok: true, data: [] })

    const result = await query(`
      SELECT a.id, a.titulo, a.creado_en, a.partidas_n,
             r.ganador_id, r.diferencia,
             j.game_name AS ganador_nombre
      FROM tbl_analisis a
      JOIN tbl_usuario u          ON u.id = a.id_usuario
      LEFT JOIN tbl_reporte r     ON r.id_analisis = a.id
      LEFT JOIN tbl_jugador j     ON j.id = r.ganador_id
      WHERE u.email = $1
      ORDER BY a.creado_en DESC
      LIMIT 50
    `, [email])
    res.json({ ok: true, data: result.rows })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── ENDPOINT 8 · GET /analisis/:id/reporte ── LÓGICA COMPLEJA ───────────────
// Reporte detallado de un análisis: scores por dimensión, conclusión,
// brechas por categoría, jugador recomendado con justificación
router.get('/:id/reporte', async (req, res) => {
  try {
    const { id } = req.params

    const analisis = await query('SELECT * FROM tbl_analisis WHERE id = $1', [id])
    if (!analisis.rows.length) return res.status(404).json({ ok: false, error: 'Análisis no encontrado' })

    const jugadores = await query(`
      SELECT axj.*, j.game_name, j.tag_line, r.codigo as region
      FROM tbl_analisis_x_jugador axj
      JOIN tbl_jugador j ON axj.id_jugador = j.id
      JOIN tbl_region r  ON j.id_region = r.id
      WHERE axj.id_analisis = $1
      ORDER BY axj.topgap_score DESC
    `, [id])

    const reporte = await query('SELECT * FROM tbl_reporte WHERE id_analisis = $1', [id])

    if (jugadores.rows.length < 2) return res.status(400).json({ ok: false, error: 'Análisis incompleto' })

    const [j1, j2] = jugadores.rows

    // Calcular brechas por dimensión
    const brechas = {
      linea:       { j1: Number(j1.score_linea),       j2: Number(j2.score_linea),       ventaja: j1.score_linea > j2.score_linea ? j1.game_name : j2.game_name },
      disciplina:  { j1: Number(j1.score_disciplina),  j2: Number(j2.score_disciplina),  ventaja: j1.score_disciplina > j2.score_disciplina ? j1.game_name : j2.game_name },
      teamfights:  { j1: Number(j1.score_teamfights),  j2: Number(j2.score_teamfights),  ventaja: j1.score_teamfights > j2.score_teamfights ? j1.game_name : j2.game_name },
      vision:      { j1: Number(j1.score_vision),      j2: Number(j2.score_vision),      ventaja: j1.score_vision > j2.score_vision ? j1.game_name : j2.game_name },
    }

    // Dimensión con mayor brecha
    const mayorBrecha = Object.entries(brechas).sort((a, b) =>
      Math.abs(b[1].j1 - b[1].j2) - Math.abs(a[1].j1 - a[1].j2)
    )[0]

    res.json({
      ok: true,
      data: {
        analisis: analisis.rows[0],
        jugadores: jugadores.rows,
        brechas,
        mayor_brecha: { dimension: mayorBrecha[0], datos: mayorBrecha[1] },
        reporte: reporte.rows[0] || null,
        recomendacion: {
          jugador: j1.game_name,
          motivo: `Supera en ${j1.topgap_score - j2.topgap_score} puntos TopGap con ventaja principal en ${mayorBrecha[0]}`
        }
      }
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Generador de conclusión textual ──────────────────────────────────────────
function generarConclusion(ganador, perdedor, diferencia, mG, mP) {
  const nivel = diferencia >= 20 ? 'significativa' : diferencia >= 10 ? 'moderada' : 'ajustada'
  const puntoFuerte = mG.scoreLinea > mP.scoreLinea ? 'dominio de línea'
    : mG.scoreDisciplina > mP.scoreDisciplina ? 'disciplina y bajas muertes'
    : mG.scoreTeamfights > mP.scoreTeamfights ? 'impacto en teamfights'
    : 'control de visión'
  return `${ganador} supera a ${perdedor} con una ventaja ${nivel} de ${diferencia} puntos. Su principal fortaleza es el ${puntoFuerte}, dimensión clave en la evaluación TopGap para Top Laners.`
}

module.exports = router
