import { env } from 'cloudflare:workers';
import { GameError,mutate,view } from './game-engine.mjs';
import data from '../data/players.json';
import clubs from '../data/clubs.json';
export async function transact(action:string,body:Record<string,unknown>,token:string){
 const db=env.DB;if(!db)throw new GameError('The game is temporarily unavailable. Please try again.',503);
 await db.prepare('INSERT OR IGNORE INTO game_registry (id,version,state) VALUES (1,0,?)').bind('{"rooms":[]}').run();
 for(let attempt=0;attempt<16;attempt++){
  const row=await db.prepare('SELECT version,state FROM game_registry WHERE id=1').first<{version:number,state:string}>();
  if(!row)throw new Error('Missing registry');
  const registry=JSON.parse(row.state),now=Date.now();
  const room=mutate(registry,action,body,token,data.players,clubs,now);
  const result=await db.prepare('UPDATE game_registry SET state=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(registry),row.version).run();
  if(result.meta.changes===1)return action==='leave'?{left:true}:view(room,token,data.players,now);
 }
 throw new GameError('The room is busy. Retrying shortly.',503);
}
export {clubs};
