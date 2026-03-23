import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

async function captureCard(el) {
  const prev = el.style.overflow
  el.style.overflow = 'visible'
  try {
    return await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      width: el.scrollWidth,
      height: el.scrollHeight,
    })
  } finally {
    el.style.overflow = prev
  }
}

export async function exportPNG(el) {
  const dataUrl = await captureCard(el)
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
  const dataUrl = await captureCard(el)
  const w = el.scrollWidth
  const h = el.scrollHeight
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
  const dataUrl = await captureCard(el)
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
