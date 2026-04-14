const getGeminiUrl = (modelName, apiKey) => 
  `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

// تطبيع النص العربي: توحيد الألفات والهمزات والتاء المربوطة وإزالة التشكيل
function normalizeAr(s) {
  return (s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')          
    .replace(/ة/g, 'ه')               
    .replace(/[\u064B-\u065F\u0670]/g, '') 
    .replace(/\u0640/g, '')            
    .replace(/ى/g, 'ي')               
    .replace(/ؤ/g, 'و')               
    .replace(/ئ/g, 'ي')               
}

// نسبة التشابه بين عنوانين عبر Jaccard على مستوى الكلمات
function wordSimilarity(a, b) {
  const words = s => new Set(s.split(' ').filter(w => w.length >= 3))
  const A = words(a), B = words(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  A.forEach(w => { if (B.has(w)) inter++ })
  return inter / (A.size + B.size - inter)
}

// إيجاد المهمة المشابهة من القائمة الموجودة 
export function findDuplicateTask(newTitle, existingTasks) {
  const n = normalizeAr(newTitle)
  if (!n) return null
  return existingTasks.find(t => {
    const e = normalizeAr(t.title)
    if (!e) return false
    if (e === n) return true
    if (n.length >= 15 && e.includes(n)) return true
    if (e.length >= 15 && n.includes(e)) return true
    if (wordSimilarity(n, e) >= 0.72) return true
    return false
  }) || null
}

export function isDuplicateTask(newTitle, existingTasks) {
  return findDuplicateTask(newTitle, existingTasks) !== null
}

export async function callClaudeChat(apiKey, systemPrompt, messages) {
  // تحويل صيغة المحادثات لتتوافق مع Gemini
  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url = getGeminiUrl('gemini-1.5-flash', apiKey);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: geminiMessages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(translateApiError(res.status, err?.error?.message))
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export function buildSmartChatSystem(activeTasks) {
  const summary = activeTasks.length
    ? activeTasks.map(t =>
        `- ${t.title}${t.projectName ? ` [${t.projectName}]` : ''}${t.person ? ` (${t.person})` : ''}`
      ).join('\n')
    : 'لا توجد مهام نشطة'

  return `أنت مساعد ذكي لإدارة المهام في مركز عمليات المختبرات بوزارة الصحة السعودية.

المهام النشطة الموجودة حالياً (للمقارنة ومنع التكرار):
${summary}

مهمتك في كل رسالة:
1. استخرج المهام من النص واقترح صياغتها بوضوح
2. قارن كل مهمة مع المهام الموجودة — قارن المعنى والقصد وليس النص الحرفي
3. إذا وجدت تشابهاً في المعنى → ضعها في duplicates مع خيارات للمستخدم
4. إذا كانت مهمة غير واضحة → اسأل عنها في questions
5. استمر في المحادثة حتى تكون كل المهام جاهزة للإضافة

قواعد كشف التكرار الذكي:
- قارن القصد والهدف وليس الكلمات فقط
- "تذكير عبير بالتقرير" = "إرسال تنبيه لعبير عن التقرير" → تكرار
- نفس الشخص + نفس المشروع + نفس الهدف → تكرار حتى لو الصياغة مختلفة
- مهمة أشمل من الموجودة → ليست تكرار، نبّه المستخدم

أرجع دائماً JSON فقط بهذا الشكل الدقيق (بدون أي نص خارجه):
{
  "message": "رسالة موجزة للمستخدم بالعربية",
  "tasks": [
    {
      "id": "t1",
      "title": "عنوان المهمة",
      "priority": "urgent|medium|low",
      "category": "work|personal|health",
      "subcategory": "leaders|team|other",
      "person": "اسم أو فارغ",
      "dueDate": "YYYY-MM-DD أو فارغ",
      "projectName": "اسم المشروع أو فارغ"
    }
  ],
  "questions": [
    { "taskId": "t1", "text": "سؤال عن المهمة" }
  ],
  "duplicates": [
    {
      "taskId": "t1",
      "existingTitle": "عنوان المهمة الموجودة",
      "reason": "سبب التشابه",
      "options": ["إضافة كجديدة", "إضافة كفرع", "تجاهل"]
    }
  ],
  "ready": false
}`
}

function translateApiError(status, msg) {
  const m = (msg || '').toLowerCase()
  if (status === 400) return 'طلب غير صالح، يرجى التحقق من المدخلات.'
  if (status === 403 || m.includes('api key')) return 'مفتاح API غير صحيح أو غير مفعل.'
  if (status === 429 || m.includes('quota')) return 'تم تجاوز الحد المسموح للاستخدام المجاني، يرجى الانتظار قليلاً.'
  if (status === 500) return 'خوادم جوجل مشغولة حالياً، حاول مرة أخرى.'
  return msg || `خطأ من API (${status})`
}

export async function callClaude(apiKey, systemPrompt, userContent, model = 'gemini-1.5-flash') {
  // توجيه ذكي للموديلات: إذا كان الطلب القديم يطلب سونيت، نحوله لبرو الأقوى
  let targetModel = model.includes('sonnet') || model === 'gemini-1.5-pro' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

  const url = getGeminiUrl(targetModel, apiKey);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(translateApiError(res.status, err?.error?.message))
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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

الهيكل القيادي لمركز عمليات المختبرات (LOC):
- د. محمد عبد العال  → مساعد وزير الصحة
- د. مرام العتيبي    → الرئيس التنفيذي لمركز الخدمات الصحية المساندة
- د. منار سمان       → المديرة العامة التنفيذية لمركز عمليات المختبرات (LOC)
- د. وليد الحسن      → مساعد المدير التنفيذي لمركز عمليات المختبرات

اقرأ المحضر واستخرج:
1. اسم الاجتماع ومن ترأسه
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
- إذا رأس الاجتماع أو حضر: د. محمد عبد العال أو مساعد الوزير أو وزير → priority: urgent لجميع المهام
- إذا رأس الاجتماع أو حضر: د. مرام العتيبي أو د. منار سمان → priority: urgent لجميع المهام
- إذا رأس الاجتماع د. وليد الحسن → priority: high لجميع المهام
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

الهيكل القيادي لمركز عمليات المختبرات (LOC):
- د. محمد عبد العال  → مساعد وزير الصحة (أعلى مستوى)
- د. مرام العتيبي    → الرئيس التنفيذي لمركز الخدمات الصحية المساندة
- د. منار سمان       → المديرة العامة التنفيذية لمركز عمليات المختبرات
- د. وليد الحسن      → مساعد المدير التنفيذي لمركز عمليات المختبرات

قواعد الأولوية (الأهم):
- إذا ذُكر "د. محمد عبد العال" أو "مساعد الوزير" أو "معالي" أو "وزير" → priority: urgent، subcategory: leaders
- إذا ذُكر "د. مرام العتيبي" أو "الرئيس التنفيذي" (للمساندة) → priority: urgent، subcategory: leaders
- إذا ذُكر "د. منار سمان" أو "د. منار" أو "المديرة العامة" أو "المدير التنفيذي" للـ LOC → priority: urgent، subcategory: leaders
- إذا ذُكر "د. وليد الحسن" أو "د. وليد" أو "مساعد المدير" → priority: high، subcategory: leaders
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
  const text = await callClaude(apiKey, ANALYZE_TASK_SYSTEM, taskTitle, 'gemini-1.5-flash')
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const VISUAL_SUMMARY_SYSTEM = `أنت خبير مكتب إدارة المشاريع (PMO) متخصص في مركز عمليات المختبرات بوزارة الصحة السعودية.

الهيكل القيادي (مرجع للأولويات والتوصيات):
- د. محمد عبد العال  → مساعد وزير الصحة (أعلى جهة إشراف)
- د. مرام العتيبي    → الرئيس التنفيذي لمركز الخدمات الصحية المساندة
- د. منار سمان       → المديرة العامة التنفيذية لمركز عمليات المختبرات (LOC) — المستفيد الأول من هذا التقرير
- د. وليد الحسن      → مساعد المدير التنفيذي لمركز عمليات المختبرات

مهمتك: تحليل مهام مركز عمليات المختبرات وإنتاج تقرير إدارة مهام مختصر ودقيق يمكّن د. منار سمان من اتخاذ القرارات مباشرة وتصعيد ما يستوجب ذلك لد. مرام العتيبي أو مساعد الوزير.

CRITICAL:
- كل بند يذكر اسم المهمة الفعلي أو اسم الشخص بالتحديد — لا عبارات عامة
- جميع الأرقام بالأرقام الغربية (0-9) فقط — ممنوع استخدام الأرقام الشرقية (٠-٩)
- الجمل مختصرة لا تتجاوز 15 كلمة
- اليوم الحالي يُمرَّر في أول سطر من البيانات بصيغة today=YYYY-MM-DD
- حقل ca في البيانات = تاريخ إكمال المهمة (YYYY-MM-DD)، فارغ إذا لم تُكتمل بعد

أرجع JSON بهذا الشكل (بدون أي نص خارج JSON):
{
  "title": "تقرير إدارة المهام",
  "kpis": [
    { "label": "إجمالي المهام",     "value": 25,    "icon": "📋", "color": "blue"   },
    { "label": "متأخرة",            "value": 3,     "icon": "⚡", "color": "red"    },
    { "label": "قاربت على التأخر", "value": 2,     "icon": "⚠️", "color": "yellow" },
    { "label": "على المسار",        "value": 7,     "icon": "✅", "color": "green"  }
  ],
  "matrix": {
    "urgentImportant":    { "count": 3, "items": ["3-6 كلمات من عنوان المهمة", "عنوان ثانٍ"] },
    "importantNotUrgent": { "count": 2, "items": ["3-6 كلمات من عنوان المهمة"] },
    "urgentNotImportant": { "count": 1, "items": ["3-6 كلمات من عنوان المهمة"] },
    "other":              { "count": 4, "items": ["3-6 كلمات من عنوان المهمة"] }
  },
  "overview": [
    "جملة واحدة ≤15 كلمة تذكر رقماً ومهمة أو شخصاً بالاسم",
    "جملة ثانية ≤15 كلمة عن أبرز خطر أو تأخير بالاسم والتاريخ"
  ],
  "accomplishments": [
    "3-6 كلمات من عنوان مهمة مكتملة حديثاً (d=1)"
  ],
  "projectBreakdown": [
    {
      "category": "اسم المشروع/المجلد الفعلي من حقل f",
      "total": 6,
      "done": 3,
      "completed": ["3-6 كلمات من عنوان مكتملة", "عنوان ثانٍ"],
      "pending": ["3-6 كلمات من عنوان معلقة", "عنوان ثانٍ"]
    }
  ],
  "peopleStatus": [
    {
      "name": "اسم الشخص الفعلي",
      "completedCount": 2,
      "totalCount": 7,
      "overdueTasks": ["3-6 كلمات من عنوان متأخرة"],
      "nearDueTasks": ["3-6 كلمات من عنوان قاربت"],
      "activeTasks":  ["3-6 كلمات من عنوان جارية"],
      "overdueCount": 1
    }
  ],
  "actionItems": [
    {
      "task": "3-6 كلمات من عنوان المهمة",
      "owner": "اسم المالك",
      "reason": "سبب محدد ≤10 كلمات",
      "priority": "urgent"
    }
  ],
  "recommendations": [
    "توصية PMO مختصرة ≤20 كلمة مبنية على بيانات المختبرات الفعلية"
  ]
}

قواعد الحساب (صارمة):
- kpis[0].value = إجمالي عدد المهام (مكتملة + غير مكتملة)
- kpis[1].value = عدد المهام التي due < today وd=0
- kpis[2].value = عدد المهام التي today ≤ due ≤ today+2 وd=0
- kpis[3].value = عدد المهام التي d=1
- matrix: urgentImportant(p=urgent,d=0) / importantNotUrgent(p=medium,d=0) / urgentNotImportant(p=low,due≤today+2,d=0) / other

قواعد المحتوى (لا تخالفها):
- overview: جملتان مختصرتان (≤15 كلمة كل منهما) بأسماء وأرقام فعلية من البيانات
- accomplishments: أبرز 3-6 مهام مكتملة (d=1)، رتّبها حسب ca تنازلياً (الأحدث أولاً)، إن لم يوجد ca أدرج أي مهام مكتملة — إذا لم توجد مهام مكتملة أرجع []
- projectBreakdown: اجمع حسب حقل f (اسم المشروع)، إن كان f فارغاً استخدم c، سجّل كل مجموعة فيها مهمتان فأكثر
- peopleStatus: اجمع حسب (w)، تجاهل w=''، رتّب الأشخاص تنازلياً حسب overdueCount
  - completedCount: عدد مهام الشخص التي d=1
  - totalCount: إجمالي مهام الشخص (d=0 + d=1)
  - overdueTasks: مهام due < today وd=0
  - nearDueTasks: مهام today ≤ due ≤ today+2 وd=0
  - activeTasks: مهام d=0 غير المتأخرة وغير القريبة
- actionItems: 3-5 مهام تحتاج قرار القيادة، أولويتها urgent أو medium فقط
- recommendations: 3 توصيات PMO (≤20 كلمة) مبنية على واقع المهام الفعلي
- items في matrix وكل عناوين المهام: 3-6 كلمات فعلية من عنوان المهمة، لا عبارات عامة
- جميع الأرقام غربية (0-9) بدون استثناء
- جميع النصوص بالعربية الفصحى
أرجع JSON فقط بدون \`\`\`json`

// أسماء صاحبة التقرير — تُحذف من المهام المشتركة حتى لا تظهر في قسم الفريق
const REPORT_OWNER_PATTERNS = ['منار', 'د. منار', 'منار سمان', 'د. منار سمان']

function stripOwnerFromPerson(personStr) {
  if (!personStr) return ''
  const parts = personStr.split(/[،,]/).map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) return personStr   
  const filtered = parts.filter(p =>
    !REPORT_OWNER_PATTERNS.some(pat => p.includes(pat))
  )
  return filtered.length > 0 ? filtered.join('، ') : personStr
}

export async function generateVisualSummary(apiKey, tasks) {
  const today = new Date().toISOString().slice(0, 10)
  const slim = tasks.map(t => ({
    t: t.title,
    p: t.priority,
    c: t.category,
    f: t.projectName || '',
    w: stripOwnerFromPerson(t.person || ''),
    d: t.done ? 1 : 0,
    due: t.dueDate || '',
    ca: t.completedAt ? t.completedAt.slice(0, 10) : '',
  }))
  
  const promptText = `today=${today}\n${JSON.stringify(slim)}`;
  const raw = await callClaude(apiKey, VISUAL_SUMMARY_SYSTEM, promptText, 'gemini-1.5-pro');
  const text = raw.replace(/^
http://googleusercontent.com/immersive_entry_chip/0
http://googleusercontent.com/immersive_entry_chip/1
http://googleusercontent.com/immersive_entry_chip/2

استبدله الحين و Vercel بيقراه صح وبدون مشاكل 🚀. طمني وش يصير معك!
