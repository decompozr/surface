
/** Source installs accept stable patch updates within the pinned minor series. */
export const requireCompatibleBun = (packageManager: unknown, runtime: string, prepared?: string) => {
  const baseline=typeof packageManager==='string'?/^bun@(\d+)\.(\d+)\.(\d+)$/.exec(packageManager):null;
  if(!baseline)throw new Error('Release must declare a stable Bun packageManager version.');
  const compatible=(version:string)=>{
    const parsed=/^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    return parsed && Number(parsed[1])===Number(baseline[1]) && Number(parsed[2])===Number(baseline[2]) && Number(parsed[3])>=Number(baseline[3]);
  };
  if(!compatible(runtime))throw new Error(`Use Bun >=${baseline.slice(1).join('.')} <${baseline[1]}.${Number(baseline[2])+1}.0; current runtime is bun@${runtime}.`);
  if(prepared!==undefined&&!compatible(prepared))throw new Error(`Release was prepared with unsupported bun@${prepared}. Rebuild it with a compatible runtime.`);
};
