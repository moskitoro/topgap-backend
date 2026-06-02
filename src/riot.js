require('dotenv').config()
const API_KEY = process.env.RIOT_API_KEY

const REGIONS = {
  na1:  { platform: 'na1.api.riotgames.com',  routing: 'americas' },
  la1:  { platform: 'la1.api.riotgames.com',  routing: 'americas' },
  la2:  { platform: 'la2.api.riotgames.com',  routing: 'americas' },
  br1:  { platform: 'br1.api.riotgames.com',  routing: 'americas' },
  euw1: { platform: 'euw1.api.riotgames.com', routing: 'europe'   },
  eun1: { platform: 'eun1.api.riotgames.com', routing: 'europe'   },
  kr:   { platform: 'kr.api.riotgames.com',   routing: 'asia'     },
  jp1:  { platform: 'jp1.api.riotgames.com',  routing: 'asia'     },
}

async function riotFetch(url) {
  const res = await fetch(url, { headers: { 'X-Riot-Token': API_KEY } })
  if (!res.ok) throw new Error(`Riot API ${res.status}`)
  return res.json()
}

async function buscarEnRiot(gameName, tagLine, routing) {
  return riotFetch(`https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
}

async function obtenerMetricasJugador(riotId, regionCodigo) {
  const regionData = REGIONS[regionCodigo]
  if (!regionData) return { error: 'Región inválida' }

  const [gameName, tagLine] = riotId.includes('#') ? riotId.split('#') : [riotId, regionCodigo.toUpperCase()]

  try {
    const account = await buscarEnRiot(gameName, tagLine, regionData.routing)
    const matchIds = await riotFetch(
      `https://${regionData.routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=420&count=5`
    )

    const matches = await Promise.all(matchIds.map(id =>
      riotFetch(`https://${regionData.routing}.api.riotgames.com/lol/match/v5/matches/${id}`)
    ))

    const partidasTop = matches.filter(m => {
      const p = m.info?.participants?.find(x => x.puuid === account.puuid)
      return p && (p.teamPosition === 'TOP' || p.individualPosition === 'TOP')
    })

    const metricas = calcularMetricas(partidasTop, account.puuid)

    return {
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      partidasAnalizadas: partidasTop.length,
      metricas
    }
  } catch (e) {
    if (e.message.includes('404')) return { error: 'Jugador no encontrado' }
    if (e.message.includes('403')) return { error: 'API Key expirada' }
    return { error: e.message }
  }
}

function calcularMetricas(partidas, puuid) {
  if (!partidas.length) return metricasVacias()
  const n = partidas.length
  let kdaSum = 0, kpSum = 0, dmgSum = 0, visionSum = 0, wins = 0, deaths = 0, soloKills = 0

  for (const p of partidas) {
    const part = p.info.participants.find(x => x.puuid === puuid)
    if (!part) continue
    const durMin = p.info.gameDuration / 60
    const teamKills = p.info.participants.filter(x => x.teamId === part.teamId).reduce((s, x) => s + x.kills, 0)
    const teamDmg   = p.info.participants.filter(x => x.teamId === part.teamId).reduce((s, x) => s + x.totalDamageDealtToChampions, 0)
    kdaSum    += part.deaths === 0 ? part.kills + part.assists : (part.kills + part.assists) / part.deaths
    kpSum     += teamKills > 0 ? (part.kills + part.assists) / teamKills : 0
    dmgSum    += teamDmg > 0 ? part.totalDamageDealtToChampions / teamDmg : 0
    visionSum += part.visionScore / durMin
    deaths    += part.deaths
    soloKills += part.challenges?.soloKills ?? 0
    if (part.win) wins++
  }

  const kdaAvg    = kdaSum / n
  const winrate   = wins / n
  const kpAvg     = kpSum / n * 100
  const dmgShare  = dmgSum / n * 100
  const visPerMin = visionSum / n
  const deathsAvg = deaths / n

  // Fórmula TopGap acordada
  const subCS    = 50 // sin timeline usamos neutro
  const subGold  = 50
  const subSolo  = Math.min(soloKills / n / 3, 1) * 100
  const scoreLinea = (subCS + subGold + subSolo) / 3

  const subDeaths = Math.min(Math.max(1 - deathsAvg / 5, 0), 1) * 100
  const subKDA    = Math.min(kdaAvg / 6, 1) * 100
  const scoreDisciplina = subDeaths * 0.6 + subKDA * 0.4

  const scoreTeamfights = (Math.min(kpAvg / 70, 1) * 100 + Math.min(dmgShare / 35, 1) * 100 + winrate * 100) / 3

  const scoreVision = Math.min(visPerMin / 2, 1) * 100

  const topgapScore = Math.round(scoreLinea * 0.35 + scoreDisciplina * 0.35 + scoreTeamfights * 0.15 + scoreVision * 0.15)

  return {
    topgapScore,
    scoreLinea:      Math.round(scoreLinea * 10) / 10,
    scoreDisciplina: Math.round(scoreDisciplina * 10) / 10,
    scoreTeamfights: Math.round(scoreTeamfights * 10) / 10,
    scoreVision:     Math.round(scoreVision * 10) / 10,
    kdaAvg:          Math.round(kdaAvg * 100) / 100,
    winrate:         Math.round(winrate * 1000) / 10,
    killParticipationAvg: Math.round(kpAvg * 10) / 10,
    dmgShareAvg:     Math.round(dmgShare * 10) / 10,
    visionScorePerMin: Math.round(visPerMin * 100) / 100,
  }
}

function metricasVacias() {
  return { topgapScore:0, scoreLinea:0, scoreDisciplina:0, scoreTeamfights:0, scoreVision:0, kdaAvg:0, winrate:0, killParticipationAvg:0, dmgShareAvg:0, visionScorePerMin:0 }
}

module.exports = { buscarEnRiot, obtenerMetricasJugador }
