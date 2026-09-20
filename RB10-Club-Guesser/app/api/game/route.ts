import { transact,clubs } from '@/lib/game-store';
import { GameError } from '@/lib/game-engine.mjs';
const headers={'Cache-Control':'no-store, private','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
export const dynamic='force-dynamic';
async function handle(request:Request){
 let newCookie='';
 try{
  const url=new URL(request.url);
  if(request.method==='GET'&&url.searchParams.has('catalog'))return Response.json({clubs},{headers});
  let token=request.headers.get('cookie')?.match(/(?:^|;\s*)rb10_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const raw=request.method==='POST'?await request.text():'';
  if(raw.length>4096)throw new GameError('Request too large.',413);
  let parsed:unknown;
  try{parsed=request.method==='POST'?JSON.parse(raw):{action:'poll',code:url.searchParams.get('code')};}catch{throw new GameError('Invalid JSON request.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new GameError('Invalid request.');
  const body=parsed as Record<string,unknown>;
  if(typeof body.action!=='string')throw new GameError('Invalid action.');
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)throw new GameError('This request is not allowed.',403);
   if(!request.headers.get('content-type')?.includes('application/json'))throw new GameError('Use JSON requests.',415);
  }
  if(!token){
   if(!['create','join'].includes(body.action))throw new GameError('Join a room to play.',401);
   token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   newCookie=`rb10_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`;
  }
  const hashed=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  const result=await transact(body.action,body,hashed);
  return Response.json(result,{headers:{...headers,...(newCookie?{'Set-Cookie':newCookie}:{})}});
 }catch(error){
  if(!(error instanceof GameError))console.error('RB10 request failed',error);
  return Response.json({error:error instanceof GameError?error.message:'Unable to connect to the game. Please try again.'},{status:error instanceof GameError?error.status:503,headers});
 }
}
export const GET=handle;
export const POST=handle;
