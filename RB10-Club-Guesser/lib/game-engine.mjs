export const COUNTDOWN_MS=3000,REVEAL_MS=15000,SCORE_MS=5000,DEFAULT_ANSWER_SECONDS=45;
export const roundMs=room=>(room.answerSeconds??DEFAULT_ANSWER_SECONDS)*1000+REVEAL_MS+SCORE_MS;
export const totalMs=room=>COUNTDOWN_MS+5*roundMs(room);
export class GameError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function phase(room,now){
 if(!room.start)return {name:'lobby',round:-1,deadline:room.created+300000};
 const elapsed=now-room.start;
 if(elapsed<COUNTDOWN_MS)return {name:'countdown',round:-1,deadline:room.start+COUNTDOWN_MS};
 const answerMs=(room.answerSeconds??DEFAULT_ANSWER_SECONDS)*1000,perRound=roundMs(room);
 const n=Math.floor((elapsed-COUNTDOWN_MS)/perRound);
 if(n>=5)return {name:'finished',round:4,deadline:room.start+totalMs(room)+300000};
 const beginning=room.start+COUNTDOWN_MS+n*perRound,t=now-beginning;
 return {name:t<answerMs?'answer':t<answerMs+REVEAL_MS?'reveal':'score',round:n,deadline:beginning+(t<answerMs?answerMs:t<answerMs+REVEAL_MS?answerMs+REVEAL_MS:perRound)};
}
export function clean(registry,now){registry.rooms=registry.rooms.filter(r=>{
 const idleDeadline=r.start?r.start+totalMs(r)+300000:r.created+300000;
 const emptyDeadline=Math.max(...r.players.filter(Boolean).map(p=>p.seen+10000))+120000;
 return now<idleDeadline&&now<emptyDeadline;
});}
export function randomCode(){return Array.from(crypto.getRandomValues(new Uint32Array(8)),n=>String(n%10)).join('');}
export function sample(players){const pool=players.map(p=>p.id);for(let i=pool.length-1;i>0;i--){let x;const cap=Math.floor(4294967296/(i+1))*(i+1);do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=cap);const j=x%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,5);}
export function validateName(value){if(typeof value!=='string')throw new GameError('Enter your player name.');const name=value.trim();if(!name||[...name].length>12||/[\x00-\x1f\x7f]/.test(name))throw new GameError('Use a name with 1–12 characters.');return name;}
export function score(answers,player){const correct=new Set(player.answers.map(a=>a.id));return new Set(answers.filter(x=>correct.has(x))).size;}
export function mutate(registry,action,body,token,players,clubs,now){
 clean(registry,now);
 if(action==='create'){
 const name=validateName(body.name);
  const answerSeconds=DEFAULT_ANSWER_SECONDS;
  const existing=registry.rooms.find(r=>r.players.some(p=>p?.token===token));
  if(existing)throw new GameError('You already have a room. Rejoin it or leave first.',409);
  if(registry.rooms.length>=5)throw new GameError('All rooms are full. Please try again later.',409);
  let code;do{code=randomCode()}while(registry.rooms.some(r=>r.code===code));
  const room={code,created:now,answerSeconds,players:[{token,name,seen:now,ready:false},null],start:null,match:crypto.randomUUID(),rounds:[],answers:[[],[]],sequences:[[],[]]};registry.rooms.push(room);return room;
 }
 const code=typeof body.code==='string'?body.code.toUpperCase():'';
 if(!/^\d{8}$/.test(code))throw new GameError('Enter an 8-digit room code.');
 const room=registry.rooms.find(r=>r.code===code);if(!room)throw new GameError('Room not found or expired.',404);
 let index=room.players.findIndex(p=>p?.token===token);
 if(action==='join'&&index<0){
  const name=validateName(body.name);
  if(room.start)throw new GameError('This match has already started.',409);
  index=room.players.findIndex(p=>!p);
  if(index<0)throw new GameError('This room is full.',409);
  room.players[index]={token,name,seen:now,ready:false};
 }
 if(index<0)throw new GameError('Join this room before playing.',403);
 room.players[index].seen=now;
 const state=phase(room,now);
 if(action==='ready'){
  if(!['lobby','finished'].includes(state.name))throw new GameError('The match is already in progress.',409);
  room.players[index].ready=true;
  if(room.players.every(p=>p?.ready&&now-p.seen<10000)){
   room.start=now;room.match=crypto.randomUUID();room.rounds=sample(players);room.answers=[[],[]];room.sequences=[[],[]];for(const p of room.players)p.ready=false;
  }
 }else if(action==='answer'){
  if(state.name!=='answer'||body.match!==room.match||body.round!==state.round)throw new GameError('This round is closed.',409);
  if(!Array.isArray(body.answers)||body.answers.length!==3||body.answers.some(a=>typeof a!=='string'||(a&&!clubs.some(c=>c.id===a))))throw new GameError('Choose up to three clubs from the list.');
  const used=body.answers.filter(Boolean);if(new Set(used).size!==used.length)throw new GameError('Choose each club only once.');
  if(!Number.isSafeInteger(body.sequence)||body.sequence<0)throw new GameError('Invalid answer update.');
  if(body.sequence>(room.sequences[index][state.round]??-1)){room.answers[index][state.round]=body.answers;room.sequences[index][state.round]=body.sequence;}
 }else if(action==='leave'){
  registry.rooms=registry.rooms.filter(r=>r!==room);
 }else if(!['ready','join','poll'].includes(action))throw new GameError('Unknown action.');
 return room;
}
export function view(room,token,players,now){
 const state=phase(room,now),me=room.players.findIndex(p=>p?.token===token);
 if(me<0)throw new GameError('You have left this room.',403);
 const byId=new Map(players.map(p=>[p.id,p]));
 const completed=state.name==='finished'?5:Math.max(0,state.round+(['reveal','score'].includes(state.name)?1:0));
 const points=room.players.map((_,i)=>Array.from({length:completed},(_,r)=>score(room.answers[i][r]??[],byId.get(room.rounds[r]))));
 const current=state.round>=0?byId.get(room.rounds[state.round]):null;
 const publicPlayer=current?Object.fromEntries(Object.entries(current).filter(([key])=>!['answers','excludedClubs','rank','revision','photoFile'].includes(key))):null;
 const revealed=['reveal','score','finished'].includes(state.name);
 return {code:room.code,match:room.match,answerSeconds:room.answerSeconds??DEFAULT_ANSWER_SECONDS,serverNow:now,phase:state.name,round:state.round,deadline:state.deadline,me,
  players:room.players.map((p,i)=>p?{name:p.name,ready:p.ready,connected:now-p.seen<10000,score:points[i].reduce((a,b)=>a+b,0)}:null),
  player:publicPlayer,answers:state.round>=0?(room.answers[me][state.round]??['','','']):['','',''],sequence:state.round>=0?(room.sequences[me][state.round]??-1):-1,
  correct:revealed?current.answers:undefined,opponentAnswers:revealed?(room.answers[1-me][state.round]??['','','']):undefined,
  roundScores:points.map(p=>p[state.round]??0),history:state.name==='finished'?room.rounds.map((id,r)=>({name:byId.get(id).name,scores:points.map(p=>p[r])})):undefined,
  idleDeadline:state.name==='lobby'||state.name==='finished'?state.deadline:undefined};
}
