import * as htmlToImage from 'html-to-image'
import jsPDF from 'jspdf'

// Cache the embedded font CSS so we only fetch once per session
let _fontCssCache = null

async function getArabicFontCss() {
  if (_fontCssCache !== null) return _fontCssCache

  try {
    // Fetch Google Fonts CSS (they allow CORS)
    const cssResp = await fetch(
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;900&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' } }
    )
    let css = await cssResp.text()

    // Extract all font file URLs
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map(m => m[1])

    // Fetch each font file and embed as base64
    await Promise.all(urls.map(async (url) => {
      try {
        const resp = await fetch(url)
        const buf  = await resp.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        const b64  = btoa(binary)
        const mime = url.includes('.woff2') ? 'font/woff2' : 'font/woff'
        css = css.replace(url, `data:${mime};base64,${b64}`)
      } catch { /* skip this weight if it fails */ }
    }))

    _fontCssCache = css
  } catch {
    _fontCssCache = '' // failed — fall back to whatever the browser has
  }

  return _fontCssCache
}

async function captureDataUrl(el) {
  await document.fonts.ready

  const fontEmbedCss = await getArabicFontCss()

  return htmlToImage.toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    ...(fontEmbedCss ? { fontEmbedCss } : {}),
  })
}

export async function exportPNG(el) {
  const dataUrl = await captureDataUrl(el)
  const blob    = await (await fetch(dataUrl)).blob()
  const file    = new File([blob], 'الملخص-التنفيذي.png', { type: 'image/png' })
  const isIOS   = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'الملخص التنفيذي' })
  } else {
    const link = document.createElement('a')
    link.download = `الملخص-التنفيذي-${new Date().toISOString().slice(0, 10)}.png`
    link.href = dataUrl
    link.click()
  }
}

export async function exportPDF(el) {
  const dataUrl = await captureDataUrl(el)
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl })
  const w = img.naturalWidth  / 2   // undo pixelRatio:2
  const h = img.naturalHeight / 2
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
  const blob = pdf.output('blob')
  const file = new File([blob], 'الملخص-التنفيذي.pdf', { type: 'application/pdf' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'الملخص التنفيذي' })
  } else {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'الملخص-التنفيذي.pdf'
    link.click()
    URL.revokeObjectURL(url)
  }
}

export async function shareImage(el) {
  const dataUrl = await captureDataUrl(el)
  const blob    = await (await fetch(dataUrl)).blob()
  const file    = new File([blob], 'الملخص-التنفيذي.png', { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'الملخص التنفيذي' })
  } else {
    const link = document.createElement('a')
    link.download = 'الملخص-التنفيذي.png'
    link.href = dataUrl
    link.click()
  }
}
