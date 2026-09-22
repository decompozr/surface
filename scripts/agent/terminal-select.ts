import { loadPrompts } from './prompts.ts';
export type MenuChoice = {label:string; detail:string; detected?:boolean};
export async function terminalSelect(choices:MenuChoice[],initial:number[]):Promise<number[]> {
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Interactive menu requires a terminal. Use --provider or --skills-dir.');
 const ui=await loadPrompts();
 const selected=await ui.multiselect({
  message:'Which agents should use Surface?  ● detected',
  options:choices.map((choice,index)=>({value:index,label:choice.label+(choice.detected?'  ●':''),hint:choice.detail})),
  initialValues:initial,cursorAt:initial[0]??0,required:true,
 });
 if(ui.isCancel(selected))throw new Error('Setup cancelled. No installation changes made.');
 return selected;
}
