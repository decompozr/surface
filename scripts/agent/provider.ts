import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { terminalSelect, type MenuChoice } from './terminal-select.ts';
import { loadPrompts } from './prompts.ts';

export async function selectSkills(options: { explicit?: string[]; provider?: string[]; saved?: string | string[]; mode: string; userHome?: string; env?: NodeJS.ProcessEnv; interactive?: boolean; exists?: (path:string)=>boolean; ask?: (question:string)=>Promise<string>; choose?: (choices:MenuChoice[],initial:number[])=>Promise<number[]> }) {
  const env=options.env??process.env, home=options.userHome??homedir(), exists=options.exists??existsSync;
  const providers=[
    {id:'codex',name:'Codex',root:resolve(env.CODEX_HOME??join(home,'.codex'))},
    {id:'claude',name:'Claude Code',root:join(home,'.claude')},
  ].map(p=>({...p,path:join(p.root,'skills'),detected:exists(p.root)}));
  if(options.explicit&&options.provider)throw new Error('Use --provider or --skills-dir, not both.');
  const unique=(paths:string[])=>[...new Set(paths.map(p=>resolve(p)))];
  if(options.explicit)return unique(options.explicit);
  if(options.provider)return unique(options.provider.flatMap(p=>p.split(',')).map(id=>{const match=providers.find(p=>p.id===id);if(!match)throw new Error('Use --provider codex or --provider claude.');return match.path;}));
  const saved=options.saved?unique(Array.isArray(options.saved)?options.saved:[options.saved]):[];
  if(saved.length&&options.mode!=='setup')return saved;
  const preferred=saved.length?saved:providers.filter(p=>p.detected).map(p=>p.path);
  if(!(options.interactive??process.stdin.isTTY)) {
    if(preferred.length)return preferred;
    throw new Error('Select --provider codex|claude or --skills-dir PATH; no provider was detected.');
  }
  const choices=providers.map(p=>({label:p.name,path:p.path,detected:p.detected}));
  for(const path of saved)if(!choices.some(p=>p.path===path))choices.push({label:'Saved custom directory',path,detected:false});
  const menuChoices=[...choices.map(p=>({label:p.label,detail:p.path,detected:p.detected})),{label:'Custom directory',detail:'Enter your provider’s skills directory'}];
  const initial=choices.flatMap((p,i)=>preferred.includes(p.path)?[i]:[]);
  const indices=await (options.choose??terminalSelect)(menuChoices,initial);
  if(!indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>choices.length))throw new Error('Select at least one valid provider.');
  const paths=indices.filter(i=>i<choices.length).map(i=>choices[i]!.path);
  if(!indices.includes(choices.length))return unique(paths);
  if(options.ask) {
    const custom=(await options.ask('Skills directory (absolute path): ')).trim();
    if(!custom.startsWith('/'))throw new Error('Enter an absolute directory path.');
    return unique([...paths,custom]);
  }
  const ui=await loadPrompts();
  const custom=await ui.text({message:'Custom skills directory',placeholder:'/absolute/path/to/skills',validate:value=>value?.trim().startsWith('/')?undefined:'Enter an absolute directory path.'});
  if(ui.isCancel(custom))throw new Error('Setup cancelled. No installation changes made.');
  return unique([...paths,custom.trim()]);
}
