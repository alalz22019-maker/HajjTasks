const API_URL = 'https://api.anthropic.com/v1/messages'

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
