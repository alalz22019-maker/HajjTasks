import Jimp from 'jimp'
import { mkdir } from 'fs/promises'

await mkdir('public/icons', { recursive: true })

// Gradient blue-purple background with checkmark
async function makeIcon(size) {
  const img = new Jimp({ width: size, height: size, color: 0x0c0c10ff })

  // Fill with dark bg
  img.scan(0, 0, size, size, function (x, y, idx) {
    this.bitmap.data[idx]     = 0x0c // R
    this.bitmap.data[idx + 1] = 0x0c // G
    this.bitmap.data[idx + 2] = 0x10 // B
    this.bitmap.data[idx + 3] = 0xff // A
  })

  // Draw a rounded rect effect + gradient circle
  const cx = size / 2
  const cy = size * 0.42
  const r  = size * 0.28

  // Draw ring (outer circle)
  const ringW = Math.max(2, size * 0.035)
  for (let angle = -Math.PI * 0.75; angle < Math.PI * 1.5; angle += 0.005) {
    for (let w = -ringW; w <= ringW; w++) {
      const rx = cx + (r + w) * Math.cos(angle)
      const ry = cy + (r + w) * Math.sin(angle)
      const t  = (angle + Math.PI * 0.75) / (Math.PI * 2.25)
      const rr = Math.round(0x3b + t * (0x8b - 0x3b))
      const gg = Math.round(0x82 + t * (0x5c - 0x82))
      const bb = Math.round(0xf6 + t * (0xf6 - 0xf6))
      img.setPixelColor(Jimp.rgbaToInt(rr, gg, bb, 255), Math.round(rx), Math.round(ry))
    }
  }

  // Draw checkmark
  const strokeW = Math.max(2, Math.round(size * 0.04))
  function drawLine(x1, y1, x2, y2, rr, gg, bb) {
    const dist = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.ceil(dist * 2)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = x1 + (x2 - x1) * t
      const py = y1 + (y2 - y1) * t
      for (let dx = -strokeW; dx <= strokeW; dx++) {
        for (let dy = -strokeW; dy <= strokeW; dy++) {
          if (dx * dx + dy * dy <= strokeW * strokeW) {
            img.setPixelColor(Jimp.rgbaToInt(rr, gg, bb, 255), Math.round(px + dx), Math.round(py + dy))
          }
        }
      }
    }
  }

  // Checkmark points (relative to center)
  const s = size * 0.14
  drawLine(cx - s, cy, cx - s * 0.2, cy + s * 0.8, 0x60, 0xa5, 0xfa)
  drawLine(cx - s * 0.2, cy + s * 0.8, cx + s, cy - s * 0.5, 0x60, 0xa5, 0xfa)

  // Pro text area at bottom - simple dots
  const dotY = size * 0.82
  const dotR = Math.max(2, size * 0.025)
  for (let d = 0; d < 3; d++) {
    const dx = cx + (d - 1) * size * 0.08
    for (let px = -dotR; px <= dotR; px++) {
      for (let py = -dotR; py <= dotR; py++) {
        if (px * px + py * py <= dotR * dotR) {
          img.setPixelColor(Jimp.rgbaToInt(0xa7, 0x8b, 0xfa, 200), Math.round(dx + px), Math.round(dotY + py))
        }
      }
    }
  }

  return img
}

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]
for (const s of sizes) {
  const img = await makeIcon(s)
  await img.write(`public/icons/icon-${s}x${s}.png`)
  console.log(`✅ icon-${s}x${s}.png`)
}

// Apple touch icon (180x180) — copy
const apple = await makeIcon(180)
await apple.write('public/apple-touch-icon.png')
console.log('✅ apple-touch-icon.png')
