import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import { SEV_COLORS, SRC_DOT } from '../../constants/colors'
import { timeAgo } from '../../utils/format'

const SEVERITY_RADIUS = { CRITICAL: 14, ACTIVE: 11, ELEVATED: 8, WATCH: 5 }

export default function AuraMap({ situations, signals, onSelectSituation, onSelectSignal }) {
  const [showSituations, setShowSituations] = useState(true)
  const [showSignals, setShowSignals] = useState(true)

  return (
    <div className="aura-map-wrap">
      <div className="map-layer-toggle">
        <button
          className={`feed-toggle-btn ${showSituations ? 'active' : ''}`}
          onClick={() => setShowSituations(!showSituations)}
        >SITUATIONS</button>
        <button
          className={`feed-toggle-btn ${showSignals ? 'active' : ''}`}
          onClick={() => setShowSignals(!showSignals)}
        >SIGNALS</button>
      </div>
      <MapContainer
        center={[24.0, 54.0]}
        zoom={4}
        minZoom={2}
        maxZoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showSituations && situations.map((sit) => sit.coordinates && (
          <CircleMarker
            key={sit.id}
            center={[sit.coordinates.lat, sit.coordinates.lng]}
            radius={SEVERITY_RADIUS[sit.severity] || 8}
            pathOptions={{
              fillColor: SEV_COLORS[sit.severity],
              fillOpacity: 0.85,
              color: '#ffffff',
              weight: 2,
            }}
            eventHandlers={{ click: () => onSelectSituation(sit) }}
          >
            <Tooltip>
              <strong>{sit.title}</strong><br />
              {sit.severity} · {timeAgo(sit.updated)}
            </Tooltip>
          </CircleMarker>
        ))}
        {showSignals && signals.map((sig) => sig.coordinates && (
          <CircleMarker
            key={sig.id}
            center={[sig.coordinates.lat, sig.coordinates.lng]}
            radius={4}
            pathOptions={{
              fillColor: SRC_DOT[sig.sourceType] || '#374151',
              fillOpacity: 0.7,
              color: '#ffffff',
              weight: 1,
            }}
            eventHandlers={{ click: () => onSelectSignal(sig) }}
          >
            <Tooltip>{sig.title}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
