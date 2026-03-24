const fs   = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function readFile(name) {
  const file = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(file)) return {}
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (err) { console.error(`[storage] failed to parse ${name}.json:`, err.message); return {} }
}
function writeFile(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
}
function readArray(name) {
  const file = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (err) { console.error(`[storage] failed to parse ${name}.json:`, err.message); return [] }
}
function writeArray(name, arr) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(arr, null, 2))
}

module.exports = { DATA_DIR, readFile, writeFile, readArray, writeArray }
