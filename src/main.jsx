import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase'
import './index.css'

const roles = [
  ['player','لاعب','Player OS','المسيرة، الأداء، الفرص، الملف الرياضي'],
  ['guardian','ولي أمر','Guardian OS','الأبناء، الموافقات، الخصوصية، الفرص'],
  ['coach','مدرب','Coach OS','الفرق، التدريب، الحضور، التقييمات'],
  ['academy','أكاديمية','Academy OS','اللاعبون، الفرق، المدربون، العمليات'],
]

const demo = {
  player: {title:'سلمان أحمد', sub:'U15 · ظهير أيمن · أكاديمية الرياض للنخبة', stats:[['الجاهزية','86%'],['الحضور','92%'],['فرص جديدة','3']], items:['التدريب القادم — اليوم 7:00 م','آخر تقييم — جيد جدًا','طلب تجربة — نادي العاصمة']},
  guardian: {title:'أحمد — ولي أمر', sub:'طفل واحد مرتبط · سلمان أحمد', stats:[['موافقات معلقة','2'],['حضور الشهر','92%'],['فرص جديدة','1']], items:['طلب تواصل من كشاف — يحتاج قرار','تجربة نادي العاصمة — يحتاج موافقة','تحديث خصوصية الملف — مكتمل']},
  coach: {title:'كابتن فيصل', sub:'فريق U15 · 24 لاعبًا', stats:[['لاعبون','24'],['حضور اليوم','21/24'],['تقييمات مطلوبة','5']], items:['حصة سرعة وتحمل — اليوم','3 لاعبين يحتاجون خطة تطوير','مباراة السبت — التشكيلة غير مكتملة']},
  academy: {title:'أكاديمية الرياض للنخبة', sub:'موثقة · ترخيص نافس', stats:[['لاعبون','186'],['فرق','9'],['مدربون','14']], items:['تدريب U15 — 7:00 م','3 طلبات انضمام جديدة','تقرير الحضور الأسبوعي جاهز']}
}

function App(){
  const [role,setRole]=useState('player')
  const [session,setSession]=useState(null)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [authMsg,setAuthMsg]=useState('')
  const [dbStatus,setDbStatus]=useState('جاري التحقق…')
  const [showLogin,setShowLogin]=useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session || null))
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    supabase.from('role_catalog').select('code').limit(1).then(({error})=>setDbStatus(error?'قاعدة البيانات متصلة — الوصول العام مقيد':'Supabase متصل ✓'))
    return ()=>sub.subscription.unsubscribe()
  },[])

  const d=useMemo(()=>demo[role],[role])

  async function signIn(e){
    e.preventDefault(); setAuthMsg('جاري الدخول…')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setAuthMsg(error?error.message:'تم تسجيل الدخول ✓')
  }
  async function signOut(){ await supabase.auth.signOut() }

  return <div className="app">
    <header>
      <div className="brand">Play<span>In</span><small>Sports Operating System</small></div>
      <div className="header-actions"><span className="status">{dbStatus}</span><button className="ghost" onClick={()=>session?signOut():setShowLogin(!showLogin)}>{session?'تسجيل الخروج':'تسجيل الدخول'}</button></div>
    </header>

    <main>
      <section className="hero">
        <div><span className="eyebrow">PLAYIN V0.1 · LIVE</span><h1>هوية رياضية واحدة.<br/><em>منظومة كاملة حول الرياضي.</em></h1><p>نسخة ويب حقيقية مبنية لتكون نقطة الانطلاق لـ PlayIn: أدوار متعددة، صلاحيات، موافقات، ومسار رياضي موحد.</p></div>
        <div className="trust"><b>Verified Facts</b><span>Coach Evaluation</span><i>AI Inference</i></div>
      </section>

      {showLogin && !session && <form className="login" onSubmit={signIn}><h3>تسجيل الدخول إلى PlayIn</h3><input placeholder="البريد الإلكتروني" type="email" value={email} onChange={e=>setEmail(e.target.value)} /><input placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><button>دخول</button><p>{authMsg}</p></form>}

      <section className="roles">
        {roles.map(([id,ar,en,desc])=><button key={id} className={role===id?'role active':'role'} onClick={()=>setRole(id)}><span>{ar}</span><b>{en}</b><small>{desc}</small></button>)}
      </section>

      <section className="workspace">
        <div className="workspace-head"><div><span className="eyebrow">{roles.find(r=>r[0]===role)[2]}</span><h2>{d.title}</h2><p>{d.sub}</p></div><span className="badge">Demo data · بيانات تجريبية</span></div>
        <div className="stats">{d.stats.map(([k,v])=><div className="stat" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
        <div className="grid">
          <article><h3>اليوم</h3>{d.items.map((x,i)=><div className="row" key={i}><span className="dot"></span><span>{x}</span></div>)}</article>
          <article><h3>مسار PlayIn</h3><div className="timeline"><div><b>هوية موحدة</b><span>PlayIn ID واحد لكل شخص</span></div><div><b>صلاحيات حسب الدور</b><span>كل Workspace له بيانات وإجراءات مختلفة</span></div><div><b>الثقة أولًا</b><span>الموثق منفصل عن الرأي وعن الذكاء الاصطناعي</span></div></div></article>
        </div>
      </section>
    </main>

    <nav><button className="active">الرئيسية</button><button>استكشف</button><button>الرسائل</button><button>الإشعارات</button></nav>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
