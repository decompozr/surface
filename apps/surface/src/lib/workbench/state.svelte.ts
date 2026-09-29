export type CommandId = 'pages.open'|'commands.open'|'pane.left.toggle'|'pane.right.toggle'|'status.toggle'|'tabs.close'|'tabs.next'|'tabs.previous'|'notifications.open'|'keymap.open'|'tabs.moveLeft'|'tabs.moveRight'|'review.select'|'review.comment'|'review.capture';
export const commands: {id:CommandId;label:string;key:string}[]=[
{id:'review.select',label:'Toggle selection mode',key:'v'},{id:'review.comment',label:'Comment on hovered element',key:'c'},{id:'review.capture',label:'Capture hovered element',key:'s'},
{id:'pages.open',label:'Open surface',key:'Mod+p'}, {id:'commands.open',label:'Show commands',key:'Mod+Shift+p'},
{id:'pane.left.toggle',label:'Toggle Workspaces',key:'Mod+b'}, {id:'pane.right.toggle',label:'Toggle Comments',key:'Mod+Alt+b'},
{id:'status.toggle',label:'Toggle status bar',key:''}, {id:'tabs.close',label:'Close active surface',key:'Mod+Shift+w'},
{id:'tabs.next',label:'Next surface',key:'Alt+ArrowRight'}, {id:'tabs.previous',label:'Previous surface',key:'Alt+ArrowLeft'},
{id:'keymap.open',label:'Keyboard shortcuts',key:''},{id:'tabs.moveLeft',label:'Move active tab left',key:''},{id:'tabs.moveRight',label:'Move active tab right',key:''},
{id:'notifications.open',label:'Show notifications',key:''}];
interface WorkbenchPreferences {left:boolean;right:boolean;leftWidth:number;rightWidth:number;status:boolean;keymap:Partial<Record<CommandId,string>>}
interface WorkbenchNotification {id:string;message:string;tone:string;dismissed?:boolean}
const defaults:WorkbenchPreferences={left:false,right:false,leftWidth:280,rightWidth:350,status:true,keymap:{}};
export const workbench=$state<WorkbenchPreferences & {notifications:WorkbenchNotification[]}>({...defaults,notifications:[]});
const key='surface.workbench.v1';
export const restoreWorkbench=()=>{try{const value:unknown=JSON.parse(localStorage.getItem(key)||'null');if(value&&typeof value==='object'){for(const k of ['left','right','status'] as const)if(k in value){const item=Reflect.get(value,k);if(typeof item==='boolean')workbench[k]=item;};for(const k of ['leftWidth','rightWidth'] as const)if(k in value){const item=Reflect.get(value,k);if(typeof item==='number'&&Number.isFinite(item))workbench[k]=Math.max(200,Math.min(600,item));};workbench.keymap={};if('keymap' in value&&value.keymap&&typeof value.keymap==='object')for(const c of commands){const binding=Reflect.get(value.keymap,c.id);if(typeof binding==='string')workbench.keymap[c.id]=binding;}}else{workbench.left=localStorage.getItem('surface.ui.panes.workspaces')==='true';workbench.right=localStorage.getItem('surface.ui.panes.comments')==='true';}}catch{}}
export const saveWorkbench=()=>{try{localStorage.setItem(key,JSON.stringify({left:workbench.left,right:workbench.right,leftWidth:workbench.leftWidth,rightWidth:workbench.rightWidth,status:workbench.status,keymap:workbench.keymap}));}catch{}}
export const matchCommand=(event:KeyboardEvent):CommandId|undefined =>{if(event.isComposing||event.repeat)return;const parts=[event.metaKey||event.ctrlKey?'Mod':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',event.key.length===1?event.key.toLowerCase():event.key].filter(Boolean);return commands.find(c=>(workbench.keymap[c.id]??c.key).split('+').sort().join('+')===parts.sort().join('+'))?.id;}
