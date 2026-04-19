/**
 * Claude API utilities — calls Vercel serverless function at /api/chat
 * which proxies to Anthropic Claude API (key stays server-side)
 */

// ─── Core API call ──────────────────────────────────────────
async function callAPI(messages, system, model) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, model }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.text || ''
}

// ─── Chat (multi-turn) ─────────────────────────────────────
export async function callClaudeChat(apiKey, systemPrompt, messages) {
  // apiKey param kept for backward compatibility but not used (key is server-side)
  const claudeMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))
  return callAPI(claudeMessages, systemPrompt)
}

// ─── Single message ─────────────────────────────────────────
export async function callClaude(apiKey, systemPrompt, userContent, modelName) {
  return callAPI(
    [{ role: 'user', content: userContent }],
    systemPrompt,
    modelName // ignored on server, always uses sonnet
  )
}

// ─── Dedup helpers ──────────────────────────────────────────
function normalizeAr(s) {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\u0640/g, '')
    .replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
}

function wordSimilarity(a, b) {
  const words = s => new Set(s.split(' ').filter(w => w.length >= 3))
  const A = words(a), B = words(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  A.forEach(w => { if (B.has(w)) inter++ })
  return inter / (A.size + B.size - inter)
}

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

// ─── Smart Chat System Prompt ───────────────────────────────
export function buildSmartChatSystem(activeTasks, userName) {
  const tasksSummary = activeTasks.length
    ? activeTasks.slice(0, 25).map(t =>
        `- ${t.title}${t.projectName ? ` [${t.projectName}]` : ''}${t.person ? ` (${t.person})` : ''}${t.status ? ` {${t.status}}` : ''}`
      ).join('\n')
    : 'لا توجد مهام نشطة'

  const stats = {
    total: activeTasks.length,
    urgent: activeTasks.filter(t => t.priority === 'urgent').length,
    byPerson: {},
    byProject: {},
  }
  activeTasks.forEach(t => {
    if (t.person) stats.byPerson[t.person] = (stats.byPerson[t.person] || 0) + 1
    if (t.projectName) stats.byProject[t.projectName] = (stats.byProject[t.projectName] || 0) + 1
  })

  return `أنت "مهامي" — مساعد ذكي لمكتب إدارة المشاريع (PMO) بمركز عمليات المختبرات، وزارة الصحة السعودية.
اسم المستخدم: ${userName || 'غير محدد'}

═══ شخصيتك ═══
- ذكي، سريع البديهة، مختصر
- تفهم العامية السعودية والفصحى
- لو قالوا لك "سعد" تعرف إنه "أ. سعد القرشي"، "حماد" = "أ. حماد المظيبري"، "وفاء" = "أ. وفاء آل إسماعيل"، "منار" = "د. منار سمان"، "وليد" = "د. وليد الحسن"، "عبير" = "أ. عبير الشدوخي"، "حامد" = "د. حامد الزهراني"، "مرام" = "د. مرام الشهراني"، "أميرة" = "أ. أميرة التميمي"، "مشاعل" = "أ. مشاعل المطيري"، "صفاء" = "أ. صفاء الشهري"، "أمجاد" = "أ. أمجاد المطيري"
- تعطي إجابات عملية ومباشرة — مو أكاديمية

═══ المهام النشطة حالياً (${stats.total}) ═══
${stats.urgent > 0 ? `⚠️ عاجلة: ${stats.urgent}` : ''}
حسب الشخص: ${Object.entries(stats.byPerson).map(([k,v]) => `${k}(${v})`).join('، ') || 'لا يوجد'}
حسب المشروع: ${Object.entries(stats.byProject).map(([k,v]) => `${k}(${v})`).join('، ') || 'لا يوجد'}

${tasksSummary}

═══ قواعد الرد ═══

1️⃣ سؤال عادي (كم مهمة؟ وش العاجل؟ وش أسوي اليوم؟):
→ جاوب بشكل طبيعي ومختصر بناء على البيانات أعلاه. لا JSON.

2️⃣ طلب إضافة مهمة ("أضف مهمة على سعد..."، "سوّ لي مهمة..."، "ذكّر حماد..."):
→ أولاً: اكتب رد قصير يوضح وش فهمت
→ ثانياً: ضع المهام في JSON block:
\`\`\`json
{"tasks": [{"id": "t1", "title": "عنوان واضح ومحدد", "priority": "urgent|medium|low", "person": "الاسم الكامل", "dueDate": "YYYY-MM-DD أو فارغ", "projectName": "اسم المشروع لو واضح"}]}
\`\`\`

3️⃣ محضر اجتماع أو نص طويل:
→ استخرج كل مهمة/قرار/توصية → رتبها حسب الأولوية → ضعها في JSON block

4️⃣ مساعدة في الصياغة ("ساعدني أصيغ..."، "كيف أكتب..."):
→ اقترح صياغات واضحة ومحددة → لو المستخدم وافق ضعها في JSON

5️⃣ تحليل وتخطيط ("وش رأيك نسوي؟"، "خطّط لي..."، "حلّل الوضع"):
→ قدّم تحليل مختصر مع توصيات عملية

═══ تحذيرات ═══
- لا تكرر مهام موجودة بالفعل في القائمة أعلاه
- لو المهمة مشابهة لموجودة → نبّه المستخدم
- "عاجل"/"ضروري"/"فوري" = priority: "urgent"
- التاريخ: لو قال "بكرا" احسبها، "الأسبوع الجاي" = أقرب أحد، "نهاية الشهر" = آخر يوم
- أرجع JSON فقط داخل block — لا تخلطه مع النص`
}

// ─── Extract tasks from text (Notes page) ───────────────────
export const EXTRACT_SYSTEM = `أنت مساعد ذكي لاستخراج المهام من النصوص العربية. حلل النص واستخرج كل مهمة واضحة.
أرجع JSON array فقط بدون أي نص إضافي:
[{"title": "عنوان المهمة", "priority": "urgent|medium|low", "person": "", "dueDate": "", "projectName": ""}]`

export const EXTRACT_SYSTEM_EN = EXTRACT_SYSTEM

// ─── Analyze single task ────────────────────────────────────
export const ANALYZE_TASK_SYSTEM = `أنت مساعد لتحليل مهام مركز عمليات المختبرات بوزارة الصحة. حلل عنوان المهمة واقترح:
- الأولوية المناسبة
- الشخص المسؤول من الفريق (لو واضح من السياق)
- اسم المشروع المناسب
- مهام فرعية مقترحة
- سبب مختصر لاختياراتك

أعضاء الفريق: م. علي الزهراني، د. منار سمان، د. وليد الحسن، أ. عبير الشدوخي، د. حامد الزهراني، أ. حماد المظيبري، أ. محمد القرشي، أ. محمد الحجيلي، أ. سعد القرشي، أ. أميرة التميمي، د. مرام الشهراني، أ. وفاء آل إسماعيل، د. سمية الغريب، أ. مشاعل المطيري، أ. صفاء الشهري، أ. أمجاد المطيري، أ. مي الأسمري، أ. شادي نبيل

أرجع JSON فقط:
{"priority": "urgent|medium|low", "person": "", "projectName": "", "reason": "", "subTasks": ["فرعية 1", "فرعية 2"]}`

export async function analyzeTaskWithAI(apiKey, taskTitle) {
  const text = await callClaude(apiKey, ANALYZE_TASK_SYSTEM, taskTitle)
  try {
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim())
  } catch {
    return null
  }
}

// ─── PDF Meeting extraction ─────────────────────────────────
export const PDF_MEETING_SYSTEM = `أنت مساعد لاستخراج مهام مركز عمليات المختبرات (LOC). أرجع JSON فقط:
{"meetingTitle": "اسم", "chairperson": "اسم", "suggestedProject": "مشروع", "tasks": []}`

// ─── Visual Summary ─────────────────────────────────────────
export const VISUAL_SUMMARY_SYSTEM = `أنت خبير مكتب إدارة المشاريع (PMO). حلل المهام وأرجع تقرير JSON يخدم د. منار سمان. 
أرجع JSON فقط بنفس الهيكل المعتمد مسبقاً وبدون أي نصوص إضافية خارج الـ JSON.`

const REPORT_OWNER_PATTERNS = ['منار', 'د. منار', 'منار سمان', 'د. منار سمان']

function stripOwnerFromPerson(personStr) {
  if (!personStr) return ''
  const parts = personStr.split(/[،,]/).map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) return personStr   
  const filtered = parts.filter(p => !REPORT_OWNER_PATTERNS.some(pat => p.includes(pat)))
  return filtered.length > 0 ? filtered.join('، ') : personStr
}

export async function generateVisualSummary(apiKey, tasks) {
  const today = new Date().toISOString().slice(0, 10)
  const slim = tasks.map(t => ({
    t: t.title, p: t.priority, f: t.projectName || '',
    w: stripOwnerFromPerson(t.person || ''), d: t.done ? 1 : 0, due: t.dueDate || '',
    ca: t.completedAt ? t.completedAt.slice(0, 10) : '',
  }))
  
  const promptText = `today=${today}\n${JSON.stringify(slim)}`
  const raw = await callClaude(apiKey, VISUAL_SUMMARY_SYSTEM, promptText)
  
  try {
    return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim())
  } catch {
    throw new Error("فشل في استخراج التقرير المرئي.")
  }
}

export async function reviewByTaskExpert(apiKey, promptText) {
  const systemPrompt = `أنت خبير مكتب إدارة المشاريع (PMO). قدم ملاحظات احترافية ومختصرة بالعربي.`
  try {
    return await callClaude(apiKey, systemPrompt, JSON.stringify(promptText))
  } catch {
    return "تعذر إكمال مراجعة الخبير في الوقت الحالي."
  }
}
