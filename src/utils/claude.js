const API_URL = 'https://api.anthropic.com/v1/messages'

// تطبيع النص العربي: توحيد الألفات والهمزات والتاء المربوطة وإزالة التشكيل
function normalizeAr(s) {
  return (s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')          // توحيد الألف
    .replace(/ة/g, 'ه')               // تاء مربوطة → هاء
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
    .replace(/\u0640/g, '')            // إزالة التطويل (كشيدة)
    .replace(/ى/g, 'ي')               // ألف مقصورة → ياء
    .replace(/ؤ/g, 'و')               // واو بهمزة
    .replace(/ئ/g, 'ي')               // ياء بهمزة
}

// نسبة التشابه بين عنوانين عبر Jaccard على مستوى الكلمات (يتجاهل كلمات < 3 أحرف)
function wordSimilarity(a, b) {
  const words = s => new Set(s.split(' ').filter(w => w.length >= 3))
  const A = words(a), B = words(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  A.forEach(w => { if (B.has(w)) inter++ })
  return inter / (A.size + B.size - inter)
}

// إيجاد المهمة المشابهة من القائمة الموجودة (تُرجع المهمة أو null)
export function findDuplicateTask(newTitle, existingTasks) {
  const n = normalizeAr(newTitle)
  if (!n) return null
  return existingTasks.find(t => {
    const e = normalizeAr(t.title)
    if (!e) return false
    if (e === n) return true
    // تحقق من احتواء أحدهما الآخر (حد أدنى 15 حرف بعد التطبيع)
    if (n.length >= 15 && e.includes(n)) return true
    if (e.length >= 15 && n.includes(e)) return true
    // تشابه الكلمات ≥ 72% → مكرر
    if (wordSimilarity(n, e) >= 0.72) return true
    return false
  }) || null
}

export function isDuplicateTask(newTitle, existingTasks) {
  return findDuplicateTask(newTitle, existingTasks) !== null
}

export async function callClaude(apiKey, systemPrompt, userContent) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

export const EXTRACT_SYSTEM = `أنت مساعد ذكي لاستخراج المهام من النصوص العربية والإنجليزية.
استخرج المهام وأرجعها كـ JSON array بهذا الشكل بالضبط (بدون أي نص إضافي):
[
  {
    "title": "عنوان المهمة",
    "priority": "urgent|medium|low",
    "category": "work|personal|health",
    "subcategory": "leaders|team|other|home|business",
    "person": "اسم الشخص أو فارغ",
    "dueDate": "YYYY-MM-DD أو فارغ"
  }
]
- إذا ذُكر شخص معين → ضعه في person
- إذا ذُكرت كلمات مثل "عاجل" أو "فوراً" → priority: urgent
- إذا كانت المهمة متعلقة بالعمل أو الوزارة → category: work
- إذا ذُكر تاريخ → حوّله لـ YYYY-MM-DD
- أرجع JSON فقط بدون \`\`\`json أو أي نص`

export const EXTRACT_SYSTEM_EN = EXTRACT_SYSTEM

export const PDF_MEETING_SYSTEM = `أنت مساعد ذكي متخصص في استخراج المهام من محاضر الاجتماعات الحكومية (وزارة الصحة السعودية).

اقرأ المحضر واستخرج:
1. اسم الاجتماع ومن ترأسه (مساعد الوزير، الرئيس التنفيذي، الخ)
2. جميع المهام والتكليفات

أرجع JSON بهذا الشكل بالضبط (بدون أي نص إضافي):
{
  "meetingTitle": "اسم الاجتماع الكامل مع التاريخ إن وُجد",
  "chairperson": "اسم رئيس الاجتماع",
  "suggestedProject": "أقرب مشروع أو لجنة من هذه الخيارات: عيني | لجنة الفحوصات المخبرية | جاهزية المختبرات | مشروع علم الأمراض الرقمي | عام",
  "tasks": [
    {
      "title": "عنوان المهمة",
      "priority": "urgent|medium|low",
      "category": "work|personal|health",
      "subcategory": "leaders",
      "person": "اسم المسؤول عن المهمة أو فارغ",
      "dueDate": "YYYY-MM-DD أو فارغ"
    }
  ]
}

قواعد مهمة:
- كل مهام المحضر تكون subcategory: leaders (لأنها من اجتماع قيادي)
- إذا رأس الاجتماع مساعد وزير أو وزير → priority: urgent لجميع المهام
- استخرج التكليفات الواضحة فقط، ولا تخترع مهام
- أرجع JSON فقط بدون \`\`\`json`

export const ANALYZE_TASK_SYSTEM = `أنت مساعد ذكي لتحليل المهام في بيئة حكومية سعودية (وزارة الصحة).
حلل عنوان المهمة وأرجع JSON بالشكل التالي بالضبط (بدون أي نص إضافي):
{
  "priority": "urgent|medium|low",
  "category": "work|personal|health",
  "subcategory": "leaders|team|other|home|business",
  "person": "اسم الشخص أو فارغ",
  "projectName": "اسم المشروع أو المبادرة أو null",
  "reason": "سبب قصير جداً باللغة العربية",
  "subTasks": ["مهمة فرعية 1", "مهمة فرعية 2"]
}

قواعد الأولوية (الأهم):
- إذا ذُكر "الرئيس التنفيذي" (تحديداً وليس المدير التنفيذي) → priority: urgent، subcategory: leaders
- إذا ذُكر "معالي مساعد الوزير" أو "مساعد الوزير" → priority: urgent، subcategory: leaders
- إذا ذُكر "وزير" أو "معالي" → priority: urgent، subcategory: leaders
- إذا ذُكر "مجلس الإدارة" أو "القيادة" → priority: urgent، subcategory: leaders
- إذا ذُكرت كلمات "عاجل" أو "فوراً" أو "ضروري" أو "اليوم" → priority: urgent

قواعد المشروع (projectName):
- إذا كانت المهمة جزءاً من مبادرة أو مشروع → اذكر اسمه
- مثال: "تقرير منجزات التحول الرقمي" → projectName: "مشروع التحول الرقمي"
- إذا لم تكن جزءاً من مشروع محدد → projectName: null

قواعد المهام الفرعية (subTasks):
- إذا كانت المهمة كبيرة وتحتاج خطوات متعددة → قسّمها لمهام فرعية (3 إلى 5 مهام)
- إذا كانت المهمة بسيطة وواضحة → subTasks: []
- مثال: "تجهيز خطة التحول الرقمي" → subTasks: ["تحليل الوضع الراهن", "تحديد الأهداف", "إعداد خارطة الطريق", "مراجعة الميزانية"]

أرجع JSON فقط بدون \`\`\`json أو أي نص إضافي`

export async function analyzeTaskWithAI(apiKey, taskTitle) {
  const text = await callClaude(apiKey, ANALYZE_TASK_SYSTEM, taskTitle)
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const VISUAL_SUMMARY_SYSTEM = `أنت مساعد ذكي متخصص في إنشاء لوحات معلومات بصرية احترافية للمهام في بيئة حكومية سعودية (PMO وزارة الصحة).

حلل قائمة المهام وأرجع JSON بهذا الشكل الدقيق فقط (بدون أي نص خارج JSON):
{
  "title": "لوحة إدارة المهام",
  "kpis": [
    { "label": "المهام المنجزة", "value": 7,     "icon": "✅", "color": "green" },
    { "label": "المهام العاجلة", "value": 3,     "icon": "🚨", "color": "red"   },
    { "label": "قيد الانتظار",  "value": 5,     "icon": "⏳", "color": "gray"  },
    { "label": "نسبة الإنجاز",  "value": "47%", "icon": "📈", "color": "blue"  }
  ],
  "matrix": {
    "urgentImportant":    { "count": 3, "items": ["عنوان مهمة مختصر", "عنوان آخر"] },
    "importantNotUrgent": { "count": 2, "items": ["عنوان مهمة"] },
    "urgentNotImportant": { "count": 1, "items": ["عنوان مهمة"] },
    "other":              { "count": 4, "items": ["عنوان مهمة"] }
  },
  "overview": [
    "جملة أولى موجزة تلخص الوضع العام للمهام",
    "جملة ثانية عن الهدف أو الأولوية الرئيسية"
  ],
  "challenges": [
    "تحدٍّ ملموس مستنتج من البيانات",
    "تحدٍّ ثانٍ",
    "تحدٍّ ثالث"
  ],
  "insights": [
    { "label": "المهام المتأخرة",  "value": "٢"        },
    { "label": "الأكثر إسناداً",  "value": "علي (٥)"  },
    { "label": "الفئة الأكثر",   "value": "إداري"     }
  ],
  "actionItems": [
    { "text": "إجراء عاجل لا يتجاوز ثلاثين حرفاً", "priority": "high"   },
    { "text": "إجراء آخر واضح ومحدد",               "priority": "medium" }
  ],
  "recommendations": [
    "توصية استراتيجية أولى واضحة ومباشرة",
    "توصية ثانية",
    "توصية ثالثة"
  ]
}

قواعد صارمة للحساب والمحتوى:
- kpis[0].value = عدد المهام التي d=1 (منجزة)
- kpis[1].value = عدد المهام التي p=urgent وd=0 (عاجلة ومعلقة)
- kpis[2].value = عدد المهام التي d=0 وp≠urgent (معلقة وغير عاجلة)
- kpis[3].value = نسبة الإنجاز كنص "XX%"
- matrix.urgentImportant    = المهام ذات p=urgent وd=0
- matrix.importantNotUrgent = المهام ذات p=high أو p=medium وغير عاجلة
- matrix.urgentNotImportant = المهام ذات p=normal ومرتبطة بمواعيد قريبة
- matrix.other              = الباقي
- items في matrix: أقصر العناوين (≤25 حرف)، 2-3 عناصر فقط لكل ربع
- overview: جملتان فصيحتان تلخصان الواقع الفعلي للمهام
- challenges: ثلاثة تحديات حقيقية مستنتجة من البيانات، لا عامة
- insights: ثلاثة إحصائيات بأرقام حقيقية من البيانات
- actionItems: 3-4 إجراءات محددة، priority إما "high" أو "medium"
- recommendations: ثلاث توصيات استراتيجية قصيرة ومفيدة
- جميع النصوص بالعربية الفصحى الواضحة، تجنّب العامية
أرجع JSON فقط بدون \`\`\`json`

export async function generateVisualSummary(apiKey, tasks) {
  const slim = tasks.map(t => ({
    t: t.title,
    p: t.priority,
    c: t.category,
    w: t.person || '',
    d: t.done ? 1 : 0,
    due: t.dueDate || '',
  }))
  const raw = await callClaude(apiKey, VISUAL_SUMMARY_SYSTEM, JSON.stringify(slim))
  // Strip markdown code fences if Claude wraps the JSON
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('الرد غير صالح: ' + text.slice(0, 80))
  }
}
