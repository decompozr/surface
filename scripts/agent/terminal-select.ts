import { emitKeypressEvents } from 'node:readline';

export type MenuChoice = {label:string; detail:string};
/** Dependency-free so a fresh clone can show setup before installing packages. */
export async function terminalSelect(choices:MenuChoice[],initial:number[]):Promise<number[]> {
 const input=process.stdin,output=process.stdout;
 if(!input.isTTY||!output.isTTY)throw new Error('Interactive menu requires a terminal. Use --provider or --skills-dir.');
 let selected=initial[0]??0,painted=0;
 const checked=new Set(initial);
 const wasRaw=input.isRaw,wasFlowing=input.readableFlowing===true;
 // Clip each row so wrapped paths cannot corrupt redraws in a narrow terminal.
 const row=(text:string)=>Array.from(text).slice(0,Math.max(1,(output.columns||80)-2)).join('');
 function render(){
  if(painted)output.write(`\x1b[${painted}A`);
  const lines=['◇  Choose your agents (select at least one)','',...choices.map((choice,i)=>`${i===selected?'❯':' '} ${checked.has(i)?'◉':'○'} ${choice.label}`),'',`  ${choices[selected]!.detail}`,'','  ↑ ↓ Move   Space Toggle   Enter Confirm   Esc Cancel'];
  for(const line of lines)output.write('\r\x1b[2K'+row(line)+'\n');
  painted=lines.length;
 }
 return new Promise((resolve,reject)=>{
  function cleanup(){input.off('keypress',keypress);output.off('resize',render);input.off('end',cancel);process.off('SIGTERM',terminate);input.setRawMode(!!wasRaw);output.write('\x1b[?25h');if(!wasFlowing)input.pause();}
  function cancel(){cleanup();reject(new Error('Provider selection cancelled. No changes made.'));}
  function terminate(){cleanup();process.kill(process.pid,'SIGTERM');}
  function keypress(_text:string,key:{name?:string;ctrl?:boolean}){
   if(key.name==='escape'||(key.ctrl&&key.name==='c')){cancel();return;}
   if(key.name==='up'){selected=(selected+choices.length-1)%choices.length;render();}
   else if(key.name==='down'){selected=(selected+1)%choices.length;render();}
   else if(key.name==='space'){if(checked.has(selected))checked.delete(selected);else checked.add(selected);render();}
   else if(key.name==='return'){if(!checked.size){return;}cleanup();const result=[...checked].sort((a,b)=>a-b);output.write(`✓  ${result.map(i=>choices[i]!.label).join(', ')}\n`);resolve(result);}
  }
  emitKeypressEvents(input);input.setRawMode(true);input.resume();output.write('\x1b[?25l');
  input.on('keypress',keypress);output.on('resize',render);input.once('end',cancel);process.once('SIGTERM',terminate);render();
 });
}
