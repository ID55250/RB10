"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { ArrowRight,Users,Trophy,Timer,Shield,Copy,Check,X,LogOut,WifiOff } from 'lucide-react';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty } from '@/components/ui/combobox';
type Club={id:string,name:string,aliases:string[],badge?:string,loan?:boolean};
type Player={name:string,ready:boolean,connected:boolean,score:number};
type Footballer={name:string,photo:string,country:string,countryCode:string,currentClub:string,currentBadge:string,photoCredit?:{artist:string,license:string,url:string,licenseUrl:string}};
type Room={code:string,match:string,answerSeconds:number,serverNow:number,phase:string,round:number,deadline:number,me:number,players:(Player|null)[],player:Footballer|null,answers:string[],sequence:number,correct?:Club[],opponentAnswers?:string[],roundScores:number[],history?:{name:string,scores:number[]}[],idleDeadline?:number};
type Remote=Room&{left?:boolean,error?:string};
type Pending={answers:string[],match:string,round:number,code:string,sequence:number};
const empty=['','',''];
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const roomNumber=(code:string)=>`${code.slice(0,4)}-${code.slice(4)}`;
function Flag({code,name}:{code:string,name:string}){return <span className="nationality"><img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={`${name} flag`}/> {name}</span>;}
function Badge({club}:{club:{name:string,badge?:string}}){return club.badge?<img className="club-badge" src={club.badge} alt="" loading="lazy"/>:<Shield size={22} aria-hidden="true"/>;}
function ClubPicker({index,value,clubs,used,onChange,disabled}:{index:number,value:string,clubs:Club[],used:string[],onChange:(value:string)=>void,disabled:boolean}){
 const [query,setQuery]=useState('');
 const items=clubs.filter(c=>(!used.includes(c.id)||c.id===value)&&(!query||norm(c.name).includes(norm(query))||c.aliases.some(a=>norm(a).includes(norm(query)))));
 const selected=clubs.find(c=>c.id===value)||null;
 return <div className="answer-picker"><span className="answer-number">0{index+1}</span><div className="picker-body"><Combobox items={items} value={selected} onValueChange={v=>{onChange(v?.id||'');setQuery('');}} itemToStringLabel={c=>c.name} isItemEqualToValue={(a,b)=>a.id===b.id} filter={null} onInputValueChange={setQuery} disabled={disabled}><ComboboxInput aria-label={`Former club ${index+1}`} placeholder="" showClear/><ComboboxContent><ComboboxEmpty>No clubs found.</ComboboxEmpty><ComboboxList>{(club:Club)=><ComboboxItem key={club.id} value={club}><Badge club={club}/>{club.name}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div></div>;
}
export default function Home(){
 const [mode,setMode]=useState('create'),[name,setName]=useState(''),[code,setCode]=useState(''),[room,setRoom]=useState<Room|null>(null),[activeCode,setActiveCode]=useState(''),[clubs,setClubs]=useState<Club[]>([]),[answers,setAnswers]=useState<string[]>(empty),[error,setError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(true),[saved,setSaved]=useState(true),[tick,setTick]=useState(Date.now()),[copied,setCopied]=useState(false);
 const offset=useRef(0),latest=useRef<Room|null>(null),roundKey=useRef(''),sequence=useRef(0),pending=useRef<Pending|null>(null),saving=useRef(false);
 const apply=useCallback((r:Room,sent:number)=>{
  if(latest.current&&r.code===latest.current.code&&r.serverNow<latest.current.serverNow)return;
  offset.current=r.serverNow-(sent+Date.now())/2;latest.current=r;setRoom(r);setOnline(true);
  const key=`${r.match}:${r.round}`;
  if(roundKey.current!==key){roundKey.current=key;pending.current=null;setAnswers(r.answers);setSaved(true);sequence.current=r.sequence+1;}
  else sequence.current=Math.max(sequence.current,r.sequence+1);
 },[]);
 const request=useCallback(async(body:Record<string,unknown>)=>{
  const sent=Date.now();const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json() as Remote;if(!response.ok)throw new Error(result.error||'Unable to connect.');if(!result.left)apply(result,sent);return result;
 },[apply]);
 useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),100);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  localStorage.removeItem('rb10-room');
  const rememberedName=localStorage.getItem('rb10-name');if(rememberedName)setName(rememberedName);
  fetch('/api/game?catalog=1').then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<{clubs:Club[]}>}).then(d=>setClubs(d.clubs)).catch(()=>setError('Club search could not load. Please refresh to retry.'));
 },[]);
 useEffect(()=>{
  if(!activeCode)return;let alive=true;let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   const sent=Date.now();try{const response=await fetch(`/api/game?code=${activeCode}`,{cache:'no-store'});const result=await response.json() as Remote;if(!alive)return;
    if(!response.ok){if([401,403,404].includes(response.status)){setError(result.error||'Room unavailable.');setActiveCode('');setRoom(null);latest.current=null;return;}throw new Error(result.error);}
    apply(result,sent);
   }catch{if(alive)setOnline(false);}finally{if(alive)timer=setTimeout(poll,800);}
  }poll();return()=>{alive=false;clearTimeout(timer);};
 },[activeCode,apply]);
 const flush=useCallback(async()=>{
  if(saving.current||!pending.current)return;saving.current=true;
  try{while(pending.current){const current:Pending=pending.current;const r=latest.current;if(!r||r.match!==current.match||r.round!==current.round||r.phase!=='answer'||Date.now()+offset.current>=r.deadline){pending.current=null;break;}
    try{await request({action:'answer',...current});if(pending.current===current)pending.current=null;setSaved(!pending.current);setError('');}
    catch{setSaved(false);setOnline(false);break;}
  }}finally{saving.current=false;}
 },[request]);
 useEffect(()=>{const timer=setInterval(()=>void flush(),500);return()=>clearInterval(timer);},[flush]);
 function select(index:number,value:string){if(!room)return;const next=[...answers];next[index]=value;setAnswers(next);setSaved(false);pending.current={answers:next,match:room.match,round:room.round,code:room.code,sequence:sequence.current++};void flush();}
 async function enter(){setBusy(true);setError('');try{const result=await request({action:mode,name,code});setActiveCode(result.code);localStorage.setItem('rb10-name',name);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function ready(){if(!room)return;setBusy(true);setError('');try{await request({action:'ready',code:room.code});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function leave(){if(!room)return;setBusy(true);try{await request({action:'leave',code:room.code});setActiveCode('');setRoom(null);latest.current=null;pending.current=null;roundKey.current='';setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{const resetRoom=()=>{const r=latest.current;if(!r)return;latest.current=null;const payload=new Blob([JSON.stringify({action:'leave',code:r.code})],{type:'application/json'});navigator.sendBeacon('/api/game',payload);};window.addEventListener('pagehide',resetRoom);return()=>window.removeEventListener('pagehide',resetRoom);},[]);
 useEffect(()=>{
  const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
  Promise.resolve(context.registerTool({name:'read_match',description:'Read the visible RB10 match state. Opponent answers remain hidden until the round ends.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No arguments expected.');const r=latest.current;return r?{code:r.code,phase:r.phase,round:r.round+1,players:r.players,remainingSeconds:Math.max(0,Math.ceil((r.deadline-Date.now()-offset.current)/1000))}:{phase:'home'};}},{signal:lifecycle.signal})).catch(()=>{});return()=>lifecycle.abort();
 },[]);
 const seconds=room?Math.max(0,Math.ceil((room.deadline-tick-offset.current)/1000)):0;
 const me=room?.players[room.me],opponent=room?.players[1-room.me];
 const clubById=(id:string)=>clubs.find(c=>c.id===id);
 const scoreAnswer=(id:string)=>room?.correct?.some(c=>c.id===id);
 return <main className="game-shell"><header className="masthead"><a className="brand" href="/" aria-label="RB10 Club guesser home"><span className="brand-mark">RB<span>10</span></span><span className="brand-title">CLUB GUESSER</span></a><span className="duel-tag"><Users size={16}/> 1 vs 1</span></header>
 {error&&<div role="alert" className="notice error">{error}</div>}
 {!activeCode&&!room&&<><section className="intro"><div className="eyebrow">THE FOOTBALL MEMORY TEST</div><h1>RB10 Ball<br/><span>knowledge test</span></h1></section><section className="entry-card"><div className="card-top"><span className="mini-label">MATCH LOBBY</span><Shield size={19}/></div><h2>Challenge a friend</h2><Tabs value={mode} onValueChange={setMode}><TabsList className="mode-switch"><TabsTrigger value="create">Create Room</TabsTrigger><TabsTrigger value="join">Join Room</TabsTrigger></TabsList><form onSubmit={e=>{e.preventDefault();void enter();}}><label htmlFor="player-name">Your name <span>{[...name].length}/12</span></label><input id="player-name" value={name} onChange={e=>setName([...e.target.value].slice(0,12).join(''))} placeholder="Enter your player name" autoComplete="nickname" required/><TabsContent value="create"/><TabsContent value="join"><label htmlFor="room-code">Room code</label><input id="room-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="8-digit code" inputMode="numeric" pattern="[0-9]{8}" required={mode==='join'} minLength={8} maxLength={8}/></TabsContent><button className="primary" disabled={busy||!name.trim()||(mode==='join'&&code.length!==8)}>{busy?'Connecting…':mode==='create'?'Create Room':'Join Room'}<ArrowRight size={19}/></button></form></Tabs></section><div className="match-facts"><div><Trophy/><strong>5 rounds</strong></div><div><Timer/><strong>45 seconds</strong></div><div><Users/><strong>2 players</strong></div></div></>}
 {room&&<section className="match"><div className="room-bar"><button className="room-copy" onClick={async()=>{try{await navigator.clipboard.writeText(room.code);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setError(`Room No.: ${roomNumber(room.code)}`);}}}><span><b>Room No.</b><i>:</i></span><span className="room-code">{roomNumber(room.code)}</span>{copied?<Check size={16}/>:<Copy size={16}/>}</button><button className="leave" onClick={()=>void leave()} disabled={busy}><LogOut size={16}/> Leave</button></div>
 {!online&&<div className="notice" role="status"><WifiOff size={18}/> Reconnecting. The clock keeps running; your last saved answers count.</div>}
 <div className="scoreboard">{room.players.map((p,i)=><div key={i} className={`score-player ${i===room.me?'self':''}`}><span className="player-label">P{i+1}{i===room.me?' · YOU':''}</span><strong className="player-name">{p?.name||'Waiting for a friend'}</strong><span className="connection-label">{p?(p.connected?'Connected':'Disconnected'):'Share your room code'}</span><b>{p?.score??0}</b></div>)}<span className="vs">VS</span></div>
 {room.phase==='lobby'&&<div className="lobby-panel"><div className="eyebrow">YOUR MATCH STARTS HERE</div><h1>{opponent?'Ready when you are.':'Waiting for your opponent.'}</h1><div className="match-setting"><Timer size={17}/><strong>{room.answerSeconds} seconds</strong><span>per round</span></div><div className="ready-list">{room.players.map((p,i)=><span key={i}><span>P{i+1}</span>{p?(p.ready?'Ready ✓':'Not ready'):'Empty seat'}</span>)}</div><button className="primary" disabled={busy||!!me?.ready||!opponent||!online} onClick={()=>void ready()}>{me?.ready?'Waiting for opponent…':'Ready'}</button><p className="small">Room expires in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</p></div>}
 {room.phase==='countdown'&&<div className="countdown-panel" aria-live="polite"><div className="eyebrow">BOTH PLAYERS ARE READY</div><strong>{seconds||'GO'}</strong></div>}
 {['answer','reveal','score'].includes(room.phase)&&room.player&&<><div className="round-bar"><div><span className="mini-label">ROUND {room.round+1} OF 5</span><div className="round-dots">{Array.from({length:5},(_,i)=><span key={i} className={i<=room.round?'on':''}/>)}</div></div><div className={`clock ${seconds<=5&&room.phase==='answer'?'urgent':''}`}><Timer size={19}/><b>{seconds}</b><span>{room.phase==='answer'?'TO ANSWER':room.phase==='reveal'?'REVEAL':'NEXT UP'}</span></div></div>
 {room.phase!=='score'&&<div className="footballer-card"><div className="portrait"><img src={room.player.photo} alt={room.player.name}/></div><div className="footballer-info">{room.phase==='reveal'&&<span className="mini-label">THE ANSWERS ARE IN</span>}<h1>{room.player.name}</h1><Flag code={room.player.countryCode} name={room.player.country}/><div className="current-club"><Badge club={{name:room.player.currentClub,badge:room.player.currentBadge}}/><span>{room.player.currentClub}<small>CURRENT CLUB</small></span></div></div></div>}
 {room.phase==='answer'&&<div className="answer-area"><div className="answer-heading"><h2>Your three guesses</h2><span>1 point each</span></div>{empty.map((_,i)=><ClubPicker key={`${room.match}:${room.round}:${i}`} index={i} value={answers[i]||''} clubs={clubs} used={answers} onChange={v=>select(i,v)} disabled={seconds===0||!online||!clubs.length}/>)}<p className={`save-status ${!saved?'unsaved':''} ${seconds===0?'closed':''}`} role="status">{seconds===0?<span>Time is up. Revealing answers…</span>:saved?<><span className="save-icon"><Check size={14}/></span><strong>Saved</strong></>:<><span className="saving-dot"/><strong>Saving</strong></>}</p><p className="small">Your opponent's answers stay hidden until time is up.</p></div>}
 {room.phase==='reveal'&&<><div className="reveal-answers"><h2>Former first-team clubs</h2><div className="correct-clubs">{room.correct?.map(c=><div className="club-chip" key={c.id}><Badge club={c}/><span>{c.name}{c.loan&&<small>LOAN</small>}</span></div>)}</div></div><div className="comparison">{[room.me,1-room.me].map(i=><div className="answer-sheet" key={i}><div className="answer-sheet-title"><span>P{i+1}</span><h3>{room.players[i]?.name}{i===room.me?' · You':''}</h3><b>+{room.roundScores[i]}</b></div>{(i===room.me?room.answers:room.opponentAnswers||empty).map((id,j)=>{const club=clubById(id),correct=!!scoreAnswer(id);return <div className={`graded ${correct?'correct':'incorrect'}`} key={j}><span className="grade-icon">{correct?<Check size={17}/>:<X size={17}/>}</span><div className="graded-answer">{club&&<Badge club={club}/>}<span><strong>{club?.name||'No answer'}</strong><small>{correct?'CORRECT':'INCORRECT'}</small></span></div><b>{correct?'+1':'0'}</b></div>;})}</div>)}</div></>}
 {room.phase==='score'&&<div className="score-summary"><Trophy size={30}/><h1>Round {room.round+1} complete</h1><div className="round-points">{room.players.map((p,i)=><div key={i}><span>P{i+1} · {p?.name}</span><strong>+{room.roundScores[i]}</strong><span>{p?.score} points total</span></div>)}</div><p>{room.round===4?'Final result':'Next round'} in {seconds}…</p></div>}</>}
 {room.phase==='finished'&&<div className="result-panel"><Trophy size={45}/><div className="eyebrow">FULL TIME</div><h1>{me?.score===opponent?.score?'Draw':(me?.score??0)>(opponent?.score??0)?'You win!':'You lose'}</h1><div className="final-score">{room.players[0]?.score}<span>–</span>{room.players[1]?.score}</div><p>{me?.score===opponent?.score?'Nothing between you. Settle it in a rematch.':`P${(room.players[0]?.score??0)>(room.players[1]?.score??0)?1:2} · ${(room.players[0]?.score??0)>(room.players[1]?.score??0)?room.players[0]?.name:room.players[1]?.name} wins!`}</p><div className="result-rounds">{room.history?.map((h,i)=><div key={i}><span>{i+1}. {h.name}</span><b>{h.scores[0]} – {h.scores[1]}</b></div>)}</div><button className="primary" onClick={()=>void ready()} disabled={busy||!!me?.ready||!online}>{me?.ready?'Waiting for opponent…':'Play Again'}</button><p className="small">Both players must choose Play Again. Room expires in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}.</p></div>}
 </section>}
 <footer><span>PREMIER LEAGUE · LA LIGA · BUNDESLIGA<br className="mobile-break"/> · SERIE A · LIGUE 1</span></footer></main>;
}
