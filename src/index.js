require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const { setupDB } = require('./setup')

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || '*',
    'https://mvp-toplaners-i5jc.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}))
app.use(express.json())

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/jugadores', require('./routes/jugadores'))
app.use('/api/analisis',  require('./routes/analisis'))
app.use('/api/analisis',  require('./routes/ia'))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, service: 'TopGap API', version: '1.0.0' }))


// ── Arrancar ──────────────────────────────────────────────────────────────────
setupDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 TopGap API corriendo en http://localhost:${PORT}`)
      console.log(`   Endpoints disponibles:`)
      console.log(`   GET    /api/jugadores`)
      console.log(`   POST   /api/jugadores`)
      console.log(`   GET    /api/jugadores/:id`)
      console.log(`   GET    /api/jugadores/:id/historial  [complejo]`)
      console.log(`   PATCH  /api/jugadores/:id/estado`)
      console.log(`   POST   /api/analisis                 [complejo]`)
      console.log(`   GET    /api/analisis`)
      console.log(`   GET    /api/analisis/:id/reporte     [complejo]\n`)
    })
  })
  .catch(e => { console.error('Error iniciando BD:', e); process.exit(1) })
