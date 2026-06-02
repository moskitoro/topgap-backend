// TopGap Analysis Engine
// Motor de análisis inteligente basado en métricas de rendimiento

function analizarConIA({ jugador1, jugador2 }) {
  const j1 = jugador1, j2 = jugador2
  const ganador = j1.topgap_score >= j2.topgap_score ? j1 : j2
  const perdedor = ganador === j1 ? j2 : j1
  const diff = Math.abs(j1.topgap_score - j2.topgap_score)

  // Determinar nivel de diferencia
  const nivel = diff >= 25 ? 'clara' : diff >= 12 ? 'moderada' : 'ajustada'

  // Encontrar dimensión más fuerte del ganador
  const dims = [
    { key: 'score_linea',       label: 'el dominio de línea' },
    { key: 'score_disciplina',  label: 'la disciplina y control de muertes' },
    { key: 'score_teamfights',  label: 'el impacto en peleas de equipo' },
    { key: 'score_vision',      label: 'el control de visión en el mapa' },
  ]

  const mayorVentaja = dims.sort((a, b) =>
    (ganador[b.key] - perdedor[b.key]) - (ganador[a.key] - perdedor[a.key])
  )[0]

  const mayorDebilidad = dims.sort((a, b) =>
    ganador[a.key] - ganador[b.key]
  )[0]

  const perdedorFortaleza = dims.sort((a, b) =>
    perdedor[b.key] - perdedor[a.key]
  )[0]

  const perdedorDebilidad = dims.sort((a, b) =>
    perdedor[a.key] - perdedor[b.key]
  )[0]

  // Contexto de winrate
  const winCtx = (w) => w >= 55 ? 'winrate sólido' : w >= 45 ? 'winrate estable' : 'winrate bajo que debe mejorar'

  // Contexto de KDA
  const kdaCtx = (k) => k >= 4 ? 'KDA excelente' : k >= 2.5 ? 'KDA positivo' : k >= 1.5 ? 'KDA aceptable' : 'KDA negativo que refleja exceso de muertes'

  // Generar resumen
  const resumen = `${ganador.nombre} supera a ${perdedor.nombre} con una ventaja ${nivel} de ${diff} puntos TopGap. Su principal diferencial es ${mayorVentaja.label}, donde marca una brecha significativa sobre su rival. Con un ${winCtx(ganador.winrate)} del ${ganador.winrate}% y ${kdaCtx(ganador.kda_avg)}, demuestra consistencia en las partidas analizadas.`

  // Fortalezas
  const fortaleza = (j, dim) => {
    const frases = {
      score_linea: `Domina la fase de líneas con ventaja consistente en CS y oro, lo que le permite llegar a mid-game con poder de objeto.`,
      score_disciplina: `Mantiene un perfil de muertes bajo con ${kdaCtx(j.kda_avg)}, lo que minimiza los huecos que el equipo contrario puede explotar.`,
      score_teamfights: `Alta participación en peleas de equipo (${j.kill_participation_avg}%), siendo un factor determinante en los teamfights decisivos.`,
      score_vision: `Buen control de visión que le permite tomar decisiones informadas sobre rotaciones y peleas en el mapa.`,
    }
    return frases[dim.key]
  }

  // Debilidades
  const debilidad = (j, dim) => {
    const frases = {
      score_linea: `Debe mejorar el manejo de waves y tradeo en línea para no ceder ventaja de recursos al rival en early game.`,
      score_disciplina: `El número de muertes por partida es su punto débil — reducirlo incrementaría significativamente su impacto.`,
      score_teamfights: `Su participación en peleas puede mejorar; en ocasiones el split-push no genera el impacto necesario.`,
      score_vision: `Necesita invertir más en control de visión, especialmente pinkwards al salir de base para asegurar información de rotaciones.`,
    }
    return frases[dim.key]
  }

  // Recomendación de scouting
  const recomendacion = diff === 0
    ? `Ambos jugadores muestran un rendimiento equivalente. Se recomienda evaluar factores complementarios como comunicación y versatilidad de campeones antes de tomar una decisión.`
    : `Se recomienda fichar a ${ganador.nombre}: además de su ventaja en TopGap Score, su ${mayorVentaja.label} es exactamente lo que se necesita en el rol de Top Lane para generar presión sostenida durante toda la partida.`

  return Promise.resolve({
    ganador: ganador.nombre,
    resumen,
    fortaleza_j1: fortaleza(j1, dims.sort((a,b) => j1[b.key] - j1[a.key])[0]),
    fortaleza_j2: fortaleza(j2, dims.sort((a,b) => j2[b.key] - j2[a.key])[0]),
    debilidad_j1: debilidad(j1, dims.sort((a,b) => j1[a.key] - j1[b.key])[0]),
    debilidad_j2: debilidad(j2, dims.sort((a,b) => j2[a.key] - j2[b.key])[0]),
    recomendacion,
  })
}

module.exports = { analizarConIA }
