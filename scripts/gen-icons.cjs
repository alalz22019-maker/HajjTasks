const { Jimp } = require('jimp')
const { mkdir } = require('fs/promises')
const path = require('path')

// Pack r,g,b,a into 32-bit int (RGBA)
function rgba(r, g, b, a) {
  return ((r & 0xff) * 0x1000000) + ((g & 0xff) * 0x10000) + ((b & 0xff) * 0x100) + (a & 0xff)
}

async function makeIcon(size) {
  const img = new Jimp({ width: size, height: size, color: rgba(0x0c, 0x0c, 0x10, 0xff) })

  const cx = size / 2
  const cy = size * 0.42
  const r  = size * 0.28

  // Draw gradient ring
  const ringW = Math.max(2, size * 0.035)
  for (let angle = -Math.PI * 0.75; angle < Math.PI * 1.5; angle += 0.002) {
    const t = (angle + Math.PI * 0.75) / (Math.PI * 2.25)
    const rr = Math.round(0x3b + t * (0x8b - 0x3b))
    const gg = Math.round(0x82 + t * (0x5c - 0x82))
    const bb = 0xf6
    for (let w = -ringW; w <= ringW; w++) {
      const px = Math.round(cx + (r + w) * Math.cos(angle))
      const py = Math.round(cy + (r + w) * Math.sin(angle))
      if (px >= 0 && px < size && py >= 0 && py < size) {
        img.setPixelColor(rgba(rr, gg, bb, 255), px, py)
      }
    }
  }

  // Draw checkmark strokes
  const strokeW = Math.max(1, Math.round(size * 0.038))
  function drawLine(x1, y1, x2, y2, r, g, b) {
    const dist = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.ceil(dist * 3)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = x1 + (x2 - x1) * t
      const py = y1 + (y2 - y1) * t
      for (let dx = -strokeW; dx <= strokeW; dx++) {
        for (let dy = -strokeW; dy <= strokeW; dy++) {
          if (dx * dx + dy * dy <= strokeW * strokeW) {
            const fx = Math.round(px + dx)
            const fy = Math.round(py + dy)
            if (fx >= 0 && fx < size && fy >= 0 && fy < size) {
              img.setPixelColor(rgba(r, g, b, 255), fx, fy)
            }
          }
        }
      }
    }
  }

  const s = size * 0.14
  drawLine(cx - s, cy, cx - s * 0.2, cy + s * 0.8, 0x60, 0xa5, 0xfa)
  drawLine(cx - s * 0.2, cy + s * 0.8, cx + s, cy - s * 0.5, 0x60, 0xa5, 0xfa)

  // Bottom decorative dots
  const dotY = size * 0.82
  const dotR = Math.max(2, size * 0.025)
  for (let d = 0; d < 3; d++) {
    const dx = cx + (d - 1) * size * 0.08
    for (let px = -dotR; px <= dotR; px++) {
      for (let py = -dotR; py <= dotR; py++) {
        if (px * px + py * py <= dotR * dotR) {
          const fx = Math.round(dx + px)
          const fy = Math.round(dotY + py)
          if (fx >= 0 && fx < size && fy >= 0 && fy < size) {
            img.setPixelColor(rgba(0xa7, 0x8b, 0xfa, 200), fx, fy)
          }
        }
      }
    }
  }

  return img
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public')
  await mkdir(path.join(publicDir, 'icons'), { recursive: true })

  const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]
  for (const s of sizes) {
    const img = await makeIcon(s)
    await img.write(path.join(publicDir, 'icons', `icon-${s}x${s}.png`))
    console.log(`icon-${s}x${s}.png`)
  }

  const apple = await makeIcon(180)
  await apple.write(path.join(publicDir, 'apple-touch-icon.png'))
  console.log('apple-touch-icon.png')

  console.log('Done!')
}

main().catch(e => { console.error(e); process.exit(1) })
