import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

async function captureCard(el) {
  // Wait for all fonts (including IBM Plex Sans Arabic) to be fully loaded
  await document.fonts.ready

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  })

  return canvas
}

export async function exportPNG(el) {
  const canvas  = await captureCard(el)
  const dataUrl = canvas.toDataURL('image/png')
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
  const canvas  = await captureCard(el)
  const dataUrl = canvas.toDataURL('image/png')
  const w = canvas.width  / 2   // undo scale:2
  const h = canvas.height / 2
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
  const canvas  = await captureCard(el)
  const dataUrl = canvas.toDataURL('image/png')
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
