export function createRunOperation(perform:()=>Promise<void>,stop:()=>void|Promise<void>,unmount:()=>void):{
  start():void;wait():Promise<void>;state():{kind:'original-run-promise';status:'idle'|'pending'|'fulfilled'|'rejected'};error():unknown;dispose():Promise<void>;
};
