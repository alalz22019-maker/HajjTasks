import { toPng, getFontEmbedCSS } from 'html-to-image'
import jsPDF from 'jspdf'

// Pre-fetch and cache embedded font CSS (same-origin, no CORS issues)
let _fontEmbedCSS = null

async function buildFontEmbedCSS(el) {
  if (_fontEmbedCSS !== null) return _fontEmbedCSS
  try {
    _fontEmbedCSS = await getFontEmbedCSS(el)
  } catch {
    _fontEmbedCSS = ''
  }
  return _fontEmbedCSS
}

async function captureDataUrl(el) {
  await document.fonts.ready
  const fontEmbedCSS = await buildFontEmbedCSS(el)
  return toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
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
