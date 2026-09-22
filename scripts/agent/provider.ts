import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { terminalSelect, type MenuChoice } from './terminal-select.ts';
import { createInterface } from 'node:readline/promises';

export async function selectSkills(options: { explicit?: string; provider?: string; saved?: string; mode: string; userHome?: string; env?: NodeJS.ProcessEnv; interactive?: boolean; exists?: (path:string)=>boolean; ask?: (question:string)=>Promise<string>; choose?: (choices:MenuChoice[],initial:number)=>Promise<number> }) {
  const env=options.env??process.env, home=options.userHome??homedir(), exists=options.exists??existsSync;
  const providers=[
    {id:'codex',name:'Codex',root:resolve(env.CODEX_HOME??join(home,'.codex'))},
    {id:'claude',name:'Claude Code',root:join(home,'.claude')},
  ].map(p=>({...p,path:join(p.root,'skills'),detected:exists(p.root)}));
  if(options.explicit&&options.provider)throw new Error('Use --provider or --skills-dir, not both.');
  if(options.explicit)return resolve(options.explicit);
  if(options.provider){const match=providers.find(p=>p.id===options.provider);if(!match)throw new Error('Use --provider codex or --provider claude.');return match.path;}
  const saved=options.saved?resolve(options.saved):undefined;
  if(saved&&options.mode!=='setup')return saved;
  const detected=providers.filter(p=>p.detected);
  const preferred=saved??(detected.length===1?detected[0]!.path:undefined);
  if(!(options.interactive??process.stdin.isTTY)) {
    if(preferred)return preferred;
    throw new Error('Select --provider codex|claude or --skills-dir PATH; provider detection is absent or ambiguous.');
  }
  const choices=providers.map(p=>({label:`${p.name}${p.detected?'  ✓ detected':''}`,path:p.path}));
  if(saved&&!choices.some(p=>p.path===saved))choices.push({label:'Saved custom directory',path:saved});
  const defaultIndex=choices.findIndex(p=>p.path===preferred);
  const menuChoices=[...choices.map(p=>({label:p.label,detail:p.path})),{label:'Custom directory',detail:'Enter your provider’s skills directory'}];
  const index=await (options.choose??terminalSelect)(menuChoices,Math.max(0,defaultIndex));
  if(index>=0&&index<choices.length)return choices[index]!.path;
  if(index!==choices.length)throw new Error('Invalid provider selection.');
  const terminal=options.ask?undefined:createInterface({input:process.stdin,output:process.stdout});
  const ask=options.ask??((question:string)=>terminal!.question(question));
  try {
    while(true){
      const custom=(await ask('Skills directory (absolute path): ')).trim();
      if(custom.startsWith('/'))return resolve(custom);
      console.log('Enter an absolute directory path.');
    }
  }finally{terminal?.close();}
}
