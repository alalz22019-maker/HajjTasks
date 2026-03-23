// ألوان وزارة الصحة (MOH/HSSC) — Light Theme
export const D = {
  bg:        '#FFFFFF',
  bg2:       '#F4F9F6',
  bg3:       '#E8F4EE',
  border:    'rgba(0,107,63,0.15)',
  text:      '#0D2B1E',
  text2:     '#3D7A5E',
  text3:     '#8AAFA0',
  green:     '#006B3F',   greenBg:  'rgba(0,107,63,0.10)',
  red:       '#C0392B',   redBg:    'rgba(192,57,43,0.10)',
  blue:      '#0066B3',   blueBg:   'rgba(0,102,179,0.10)',
  yellow:    '#D4770A',   yellowBg: 'rgba(212,119,10,0.10)',
  gray:      '#6B8A80',   grayBg:   'rgba(107,138,128,0.10)',
  purple:    '#5B4FB8',   purpleBg: 'rgba(91,79,184,0.10)',
}

export const KPI_PALETTE = {
  green:  { color: D.green,  bg: D.greenBg,  glow: 'rgba(0,107,63,0.12)'   },
  red:    { color: D.red,    bg: D.redBg,    glow: 'rgba(192,57,43,0.12)'  },
  blue:   { color: D.blue,   bg: D.blueBg,   glow: 'rgba(0,102,179,0.12)'  },
  gray:   { color: D.gray,   bg: D.grayBg,   glow: 'rgba(107,138,128,0.08)'},
  yellow: { color: D.yellow, bg: D.yellowBg, glow: 'rgba(212,119,10,0.12)' },
}

export const MATRIX_CFG = [
  { key: 'urgentImportant',    label: 'عاجل ومهم',      icon: '🔴', color: D.red,    bg: D.redBg    },
  { key: 'importantNotUrgent', label: 'مهم وغير عاجل',  icon: '📌', color: D.blue,   bg: D.blueBg   },
  { key: 'urgentNotImportant', label: 'عاجل وغير مهم',  icon: '⚡', color: D.yellow, bg: D.yellowBg },
  { key: 'other',              label: 'أخرى',            icon: '📋', color: D.gray,   bg: D.grayBg   },
]

export const CARD = {
  background:   '#FFFFFF',
  borderRadius: 14,
  border:       D.border,
  padding:      '14px 16px',
  boxShadow:    '0 1px 6px rgba(0,107,63,0.08)',
}

export function formatDates() {
  const now = new Date()
  const hijri = now.toLocaleDateString('ar-SA-u-ca-islamic', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const gregorianEn = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return { hijri, gregorianEn }
}
