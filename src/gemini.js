// TopGap Analysis Engine
// Motor de análisis inteligente basado en métricas de rendimiento

function analizarConIA({ jugador1, jugador2 }) {
  const j1 = jugador1, j2 = jugador2
  const ganador = Number(j1.topgap_score) >= Number(j2.topgap_score) ? j1 : j2
  const perdedor = ganador === j1 ? j2 : j1
  const diff = Math.abs(Number(j1.topgap_score) - Number(j2.topgap_score))

  const nivel = diff >= 25 ? 'clara' : diff >= 12 ? 'moderada' : 'ajustada'

  // Helpers de contexto
  const winCtx = (w) => {
    const v = Number(w)
    return v >= 55 ? `un winrate sólido del ${v}%` : v >= 45 ? `un winrate estable del ${v}%` : `un winrate bajo del ${v}% que necesita mejorar`
  }
  const kdaCtx = (k) => {
    const v = Number(k)
    return v >= 4 ? `KDA excelente de ${v.toFixed(2)}` : v >= 2.5 ? `KDA positivo de ${v.toFixed(2)}` : v >= 1.5 ? `KDA aceptable de ${v.toFixed(2)}` : `KDA de ${v.toFixed(2)} que refleja exceso de muertes`
  }

  // Determinar dimensión diferencial usando métricas disponibles
  const dimensiones = [
    { key: 'winrate',                  label: 'el dominio de línea',               weight: 1.2 },
    { key: 'kda_avg',                  label: 'la disciplina y control de muertes', weight: 1.0 },
    { key: 'kill_participation_avg',   label: 'el impacto en peleas de equipo',     weight: 1.1 },
    { key: 'vision_score_per_min',     label: 'el control de visión en el mapa',    weight: 0.9 },
  ]

  // Usar sub-scores si existen, si no usar raw metrics
  const getScore = (j, dim) => {
    if (dim === 'winrate') return Number(j.score_linea ?? j.winrate ?? 0)
    if (dim === 'kda_avg') return Number(j.score_disciplina ?? j.kda_avg ?? 0)
    if (dim === 'kill_participation_avg') return Number(j.score_teamfights ?? j.kill_participation_avg ?? 0)
    if (dim === 'vision_score_per_min') return Number(j.score_vision ?? j.vision_score_per_min ?? 0)
    return 0
  }

  // Normalizar scores para comparación
  const normalize = (j, dim) => {
    const raw = getScore(j, dim.key)
    if (dim.key === 'winrate') return raw  // ya es porcentaje o score 0-100
    if (dim.key === 'kda_avg') return raw * 15  // escalar KDA para compararlo
    if (dim.key === 'kill_participation_avg') return raw  // ya es porcentaje
    if (dim.key === 'vision_score_per_min') return raw * 40  // escalar visión
    return raw
  }

  const ventajas = dimensiones.map(dim => ({
    dim,
    ventaja: normalize(ganador, dim) - normalize(perdedor, dim)
  })).sort((a, b) => b.ventaja - a.ventaja)

  const mayorVentaja = ventajas[0].dim

  // Fortaleza: dimensión más alta del jugador
  const fortalezaDim = (j) => {
    return dimensiones.slice().sort((a, b) => normalize(b, b.key) - normalize(a, a.key))
    // reordenar por valor del jugador
    const scores = dimensiones.map(d => ({ d, v: normalize(j, d.key) }))
    return scores.sort((a, b) => b.v - a.v)[0].d
  }

  const getFortalezaDim = (j) => {
    return dimensiones
      .map(d => ({ d, v: normalize(j, d.key) }))
      .sort((a, b) => b.v - a.v)[0].d
  }

  const getDebilidadDim = (j) => {
    return dimensiones
      .map(d => ({ d, v: normalize(j, d.key) }))
      .sort((a, b) => a.v - b.v)[0].d
  }

  const fortalezaTexto = (j, dim) => {
    const wr = Number(j.winrate ?? 0)
    const kda = Number(j.kda_avg ?? 0)
    const kp = Number(j.kill_participation_avg ?? 0)
    const vs = Number(j.vision_score_per_min ?? 0)
    const textos = {
      winrate: `Domina la fase de líneas con un ${wr}% de winrate, imponiendo condiciones desde el early game y llegando a mid-game con ventaja de recursos.`,
      kda_avg: `Mantiene un ${kdaCtx(kda)}, tomando decisiones seguras que minimizan los huecos que el equipo contrario puede explotar.`,
      kill_participation_avg: `Alta participación en peleas de equipo del ${kp}%, siendo un factor decisivo en los teamfights y generando presión constante en el mapa.`,
      vision_score_per_min: `Excelente control de visión (${vs.toFixed(2)} por minuto), tomando decisiones informadas sobre rotaciones y objetivos con información superior.`,
    }
    return textos[dim.key] ?? textos['winrate']
  }

  const debilidadTexto = (j, dim) => {
    const wr = Number(j.winrate ?? 0)
    const kda = Number(j.kda_avg ?? 0)
    const kp = Number(j.kill_participation_avg ?? 0)
    const vs = Number(j.vision_score_per_min ?? 0)
    const textos = {
      winrate: `Su ${wr}% de winrate indica dificultades para convertir ventajas en victorias — debe mejorar el cierre de partidas y el manejo de late game.`,
      kda_avg: `Su ${kdaCtx(kda)} señala muertes evitables que rompen el ritmo del equipo y regalan recursos al rival en momentos clave.`,
      kill_participation_avg: `Con solo ${kp}% de participación en peleas, su impacto colectivo es limitado — necesita mejorar las rotaciones y respuesta a skirmishes.`,
      vision_score_per_min: `Control de visión bajo (${vs.toFixed(2)} por minuto) lo deja tomando decisiones a ciegas, siendo vulnerable a emboscadas y perdiendo control de objetivos.`,
    }
    return textos[dim.key] ?? textos['kda_avg']
  }

  const dimF1 = getFortalezaDim(j1)
  const dimD1 = getDebilidadDim(j1)
  const dimF2 = getFortalezaDim(j2)
  const dimD2 = getDebilidadDim(j2)

  const resumen = `${ganador.nombre} supera a ${perdedor.nombre} con una ventaja ${nivel} de ${diff} puntos TopGap. Su principal diferencial es ${mayorVentaja.label}, donde marca una brecha significativa sobre su rival. Con ${winCtx(ganador.winrate)} y ${kdaCtx(ganador.kda_avg)}, demuestra consistencia en las partidas analizadas.`

  const recomendacion = diff === 0
    ? `Ambos jugadores muestran un rendimiento equivalente. Se recomienda evaluar factores complementarios como comunicación, versatilidad de campeones y rendimiento en partidas de alto impacto antes de tomar una decisión.`
    : `Se recomienda fichar a ${ganador.nombre}: su ${mayorVentaja.label} es exactamente lo que se necesita en el rol de Top Lane para generar presión sostenida. Con ${winCtx(ganador.winrate)}, ha demostrado convertir su ventaja en resultados concretos.`

  return Promise.resolve({
    ganador: ganador.nombre,
    resumen,
    fortaleza_j1: fortalezaTexto(j1, dimF1),
    fortaleza_j2: fortalezaTexto(j2, dimF2),
    debilidad_j1: debilidadTexto(j1, dimD1),
    debilidad_j2: debilidadTexto(j2, dimD2),
    recomendacion,
  })
}

module.exports = { analizarConIA }
