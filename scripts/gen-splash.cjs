const { Jimp } = require('jimp')
const { mkdir } = require('fs/promises')
const path = require('path')

function rgba(r, g, b, a) {
  return ((r & 0xff) * 0x1000000) + ((g & 0xff) * 0x10000) + ((b & 0xff) * 0x100) + (a & 0xff)
}

function drawCircle(img, cx, cy, radius, color) {
  for (let angle = 0; angle < Math.PI * 2; angle += 0.002) {
    for (let w = -2; w <= 2; w++) {
      const px = Math.round(cx + (radius + w) * Math.cos(angle))
      const py = Math.round(cy + (radius + w) * Math.sin(angle))
      const width = img.bitmap.width
      const height = img.bitmap.height
      if (px >= 0 && px < width && py >= 0 && py < height) {
        img.setPixelColor(color, px, py)
      }
    }
  }
}

function drawCheck(img, cx, cy, size, color, strokeW) {
  function line(x1, y1, x2, y2) {
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
            const w = img.bitmap.width
            const h = img.bitmap.height
            if (fx >= 0 && fx < w && fy >= 0 && fy < h) {
              img.setPixelColor(color, fx, fy)
            }
          }
        }
      }
    }
  }
  const s = size * 0.14
  line(cx - s, cy, cx - s * 0.2, cy + s * 0.8)
  line(cx - s * 0.2, cy + s * 0.8, cx + s, cy - s * 0.5)
}

async function makeSplash(w, h) {
  const img = new Jimp({ width: w, height: h, color: rgba(0x0c, 0x0c, 0x10, 0xff) })

  const cx = w / 2
  const cy = h * 0.42

  // Draw subtle gradient background lines
  for (let i = 0; i < w; i++) {
    const t = i / w
    const rr = Math.round(0x0c + t * 0x08)
    const gg = Math.round(0x0c + t * 0x05)
    const bb = Math.round(0x10 + t * 0x10)
    for (let j = 0; j < h; j++) {
      img.setPixelColor(rgba(rr, gg, bb, 255), i, j)
    }
  }

  const iconSize = Math.min(w, h) * 0.35
  const r = iconSize * 0.28

  // Ring
  for (let angle = -Math.PI * 0.75; angle < Math.PI * 1.5; angle += 0.002) {
    const t = (angle + Math.PI * 0.75) / (Math.PI * 2.25)
    const rr = Math.round(0x3b + t * (0x8b - 0x3b))
    const gg = Math.round(0x82 + t * (0x5c - 0x82))
    const bb = 0xf6
    const ringW = Math.max(3, iconSize * 0.04)
    for (let ww = -ringW; ww <= ringW; ww++) {
      const px = Math.round(cx + (r + ww) * Math.cos(angle))
      const py = Math.round(cy + (r + ww) * Math.sin(angle))
      if (px >= 0 && px < w && py >= 0 && py < h) {
        img.setPixelColor(rgba(rr, gg, bb, 255), px, py)
      }
    }
  }

  // Checkmark
  const strokeW = Math.max(2, Math.round(iconSize * 0.038))
  drawCheck(img, cx, cy, iconSize, rgba(0x60, 0xa5, 0xfa, 255), strokeW)

  // App name text area — draw simple blocks spelling "مهامي"
  // We'll draw 5 blocks representing the letters
  const textY = h * 0.72
  const blockH = Math.max(4, h * 0.008)
  const blockW = Math.max(30, w * 0.07)
  const gap = blockW * 1.4
  const totalW = 5 * blockW + 4 * (gap - blockW)
  let startX = cx - totalW / 2

  for (let i = 0; i < 5; i++) {
    const bx = startX + i * gap
    for (let px = 0; px < blockW; px++) {
      for (let py = 0; py < blockH; py++) {
        const fx = Math.round(bx + px)
        const fy = Math.round(textY + py)
        if (fx >= 0 && fx < w && fy >= 0 && fy < h) {
          img.setPixelColor(rgba(0xa7, 0x8b, 0xfa, 180), fx, fy)
        }
      }
    }
  }

  // Subtitle bar
  const subW = w * 0.25
  const subH = blockH * 0.7
  const subY = textY + blockH * 3
  for (let px = 0; px < subW; px++) {
    for (let py = 0; py < subH; py++) {
      const fx = Math.round(cx - subW / 2 + px)
      const fy = Math.round(subY + py)
      if (fx >= 0 && fx < w && fy >= 0 && fy < h) {
        img.setPixelColor(rgba(0x60, 0x70, 0x90, 120), fx, fy)
      }
    }
  }

  return img
}

async function main() {
  const splashDir = path.join(__dirname, '..', 'public', 'splash')
  await mkdir(splashDir, { recursive: true })

  const screens = [
    { name: 'splash-828x1792.png',  w: 828,  h: 1792 }, // iPhone 11 @2x
    { name: 'splash-1125x2436.png', w: 1125, h: 2436 }, // iPhone 11 Pro @3x
    { name: 'splash-750x1334.png',  w: 750,  h: 1334 }, // iPhone 8/SE @2x
    { name: 'splash-1170x2532.png', w: 1170, h: 2532 }, // iPhone 12/13/14 @3x
  ]

  for (const s of screens) {
    console.log(`Generating ${s.name}...`)
    const img = await makeSplash(s.w, s.h)
    await img.write(path.join(splashDir, s.name))
    console.log(`  ${s.name}`)
  }
  console.log('Splash screens done!')
}

main().catch(e => { console.error(e); process.exit(1) })
