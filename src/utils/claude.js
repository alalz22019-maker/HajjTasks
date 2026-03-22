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

export async function callClaude(apiKey, systemPrompt, userContent, model = 'claude-haiku-4-5-20251001') {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
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

export const VISUAL_SUMMARY_SYSTEM = `أنت مستشار استراتيجي متخصص في إعداد التقارير التنفيذية للقيادة العليا في وزارة الصحة السعودية.

مهمتك: تحليل قائمة المهام وإنتاج ملخص تنفيذي دقيق يمكّن المدير التنفيذي من اتخاذ القرارات مباشرة.

CRITICAL: كل بند يجب أن يذكر اسم المهمة الفعلي أو اسم الشخص بالتحديد — لا عبارات عامة أبداً.

أرجع JSON بهذا الشكل (بدون أي نص خارج JSON):
{
  "title": "الملخص التنفيذي",
  "kpis": [
    { "label": "نسبة الإنجاز",    "value": "47%", "icon": "📈", "color": "blue"   },
    { "label": "تحتاج قراراً",    "value": 3,     "icon": "⚡", "color": "red"    },
    { "label": "مهام متأخرة",     "value": 2,     "icon": "⚠️", "color": "yellow" },
    { "label": "على المسار",      "value": 7,     "icon": "✅", "color": "green"  }
  ],
  "matrix": {
    "urgentImportant":    { "count": 3, "items": ["اسم المهمة الفعلي مختصر", "اسم ثانٍ"] },
    "importantNotUrgent": { "count": 2, "items": ["اسم المهمة الفعلي"] },
    "urgentNotImportant": { "count": 1, "items": ["اسم المهمة الفعلي"] },
    "other":              { "count": 4, "items": ["اسم المهمة الفعلي"] }
  },
  "overview": [
    "جملة تذكر أرقاماً وأسماء فعلية: مثل 'من أصل 12 مهمة اكتملت 7، أبرز المعلقة: اسم المهمة بالضبط'",
    "جملة ثانية تذكر شخصاً أو موعداً بعينه: 'مهمة [الاسم] متأخرة X أيام ومالكها [الشخص] لم يُغلقها'"
  ],
  "projectBreakdown": [
    {
      "category": "اسم الفئة الفعلي من البيانات",
      "total": 6,
      "done": 3,
      "completed": ["اسم مهمة مكتملة فعلي", "اسم ثانٍ"],
      "pending": ["اسم مهمة معلقة فعلي", "اسم ثانٍ"]
    }
  ],
  "peopleStatus": [
    {
      "name": "اسم الشخص الفعلي من البيانات",
      "pending": ["اسم المهمة المعلقة الأولى", "اسم الثانية"],
      "overdueCount": 1
    }
  ],
  "actionItems": [
    {
      "task": "اسم المهمة بالضبط ≤20 حرف",
      "owner": "اسم المالك",
      "reason": "السبب المحدد: متأخرة X أيام / تحتاج موافقة / لم تُغلق منذ...",
      "priority": "high"
    }
  ],
  "recommendations": [
    "توصية تذكر اسم مهمة أو شخص أو موعد محدد"
  ]
}

قواعد الحساب (صارمة):
- kpis[0].value = نسبة الإنجاز "XX%"
- kpis[1].value = عدد المهام ذات p=urgent وd=0
- kpis[2].value = عدد المهام التي due قبل اليوم وd=0
- kpis[3].value = عدد المهام التي d=1
- matrix: صنّف كل مهمة حسب: urgentImportant(p=urgent,d=0) / importantNotUrgent(p=high|medium) / urgentNotImportant(p=normal+due قريب) / other

قواعد المحتوى (الأهم — لا تخالفها):
- overview: اذكر أرقاماً وأسماء مهام وأسماء أشخاص فعلية من البيانات، جملتان محددتان وليستا عامتين
- projectBreakdown: اجمع حسب الفئة (c=category)، اذكر أسماء المهام المكتملة والمعلقة (اختصر كل اسم ≤18 حرف)، أنشئ سجلاً لكل فئة فيها مهمتان أو أكثر
- peopleStatus: اجمع حسب المالك (w=person)، اذكر أسماء مهامه المعلقة بالتحديد (≤18 حرف)، احسب overdueCount من due<اليوم وd=0، تجاهل المهام التي w='' أو w فارغ
- actionItems: 3-5 مهام تحتاج قرار القيادة، اذكر اسم المهمة الفعلي + مالكها + السبب المحدد، priority إما "high" أو "medium"
- recommendations: ثلاث توصيات قصيرة تذكر أسماء مهام أو أشخاص
- items في matrix: اسم المهمة الفعلي مختصر ≤20 حرف، لا عبارات عامة
- جميع النصوص بالعربية الفصحى المناسبة للتقارير التنفيذية
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
  const raw = await callClaude(apiKey, VISUAL_SUMMARY_SYSTEM, JSON.stringify(slim), 'claude-sonnet-4-6')
  // Strip markdown code fences if Claude wraps the JSON
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('الرد غير صالح: ' + text.slice(0, 80))
  }
}
