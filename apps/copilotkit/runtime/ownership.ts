import { createStoreDomain, type OperationKind } from '../src/controls.js';

export type CaseControls = ReturnType<ReturnType<typeof createStoreDomain>['beginCase']>;
export interface OperationOutcome { readonly label: string; readonly success: boolean; readonly error: string | null }
export interface OriginalOperation {
  readonly kind: OperationKind;
  readonly label: string;
  readonly outcome: Promise<OperationOutcome>;
  readonly settled: boolean;
  succeed(): void;
  fail(error: unknown): void;
  cancel(): Promise<void>;
}
export function diagnostic(error: unknown): string {
  const value=error instanceof Error ? error.message : typeof error==='string' ? error : '[opaque operation failure]';
  return value.slice(0,256);
}
export async function boundedWait<T>(original: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired=new Promise<never>((_resolve,reject)=> { timeout=setTimeout(()=>reject(new Error(`${label} settlement deadline exceeded`)),milliseconds); });
  try { return await Promise.race([original,expired]); }
  finally { if(timeout!==undefined) clearTimeout(timeout); }
}
export class SettlementBudget {
  private readonly deadline=performance.now()+10000;
  wait<T>(original:Promise<T>,label:string):Promise<T> {
    const remaining=this.deadline-performance.now();
    if(remaining<=0) throw new Error('Original cleanup deadline exceeded; ownership retained');
    return boundedWait(original,remaining,label);
  }
}

/** Stores original accessible outcome promises and their owned cancellation
 * handles. Unsubscription/stop/idle never completes an operation on its behalf. */
export class OwnedOperations {
  private readonly operations: OriginalOperation[]=[];
  private readonly primary: string[]=[];
  private readonly cleanup: string[]=[];
  private closed=false;
  constructor(private readonly controls: CaseControls) {}
  start(kind: OperationKind, label: string, cancellation: ()=>Promise<void> = async()=>{}): OriginalOperation {
    if(this.closed || this.operations.length>=32) throw new Error('Owned operation admission closed or full');
    const token=this.controls.ownOperation(kind);
    let settled=false;
    let resolveOutcome: (value: OperationOutcome)=>void = ()=> { throw new Error('Outcome resolver not initialized'); };
    const outcome=new Promise<OperationOutcome>(resolve=> {resolveOutcome=resolve;});
    const finish=(success: boolean,error: string|null)=> {
      if(settled) throw new Error('Original outcome already settled');
      settled=true;
      if(success) token.settle();
      else if(kind==='server-disposal' || kind==='harness-disposal') this.cleanupFailure(error??'Original disposal failed');
      else this.primary.push(error??'Original operation failed');
      resolveOutcome({label,success,error});
    };
    const operation: OriginalOperation={kind,label,outcome,get settled(){return settled;},succeed:()=>finish(true,null),fail:error=>finish(false,diagnostic(error)),cancel:cancellation};
    this.operations.push(operation); return operation;
  }
  async run<T>(kind: OperationKind,label: string,work: ()=>Promise<T>,cancel?:()=>Promise<void>): Promise<T> {
    const operation=this.start(kind,label,cancel);
    try { const original=work(); const result=await original; operation.succeed(); return result; }
    catch(error) { operation.fail(error); throw error; }
  }
  closeAdmission(): void { this.closed=true; this.controls.closeAdmission(); }
  async cancelOriginals(budget=new SettlementBudget()): Promise<void> {
    for(const operation of this.operations) {
      if(operation.settled) continue;
      if(operation.kind==='server-disposal' || operation.kind==='harness-disposal') continue;
      try { await budget.wait(operation.cancel(),`${operation.label}: cancellation`); }
      catch(error) { this.cleanup.push(diagnostic(error));break; }
    }
  }
  async awaitOriginals(includeDisposal=false,budget?:SettlementBudget): Promise<void> {
    const originals=this.operations.filter(operation=>!operation.settled && (includeDisposal || (operation.kind!=='server-disposal' && operation.kind!=='harness-disposal'))).map(operation=>operation.outcome);
    const original=Promise.all(originals);
    if(budget) await budget.wait(original,'Owned original operations');else await boundedWait(original,10000,'Owned original operations');
    if(this.primary.length || this.cleanup.length) throw new Error('Owned operation failure retains store and forbids reuse');
  }
  cleanupFailure(error:unknown):void {if(this.cleanup.length<32) this.cleanup.push(diagnostic(error));}
  failures(): {readonly primary: readonly string[];readonly cleanup: readonly string[]} { return {primary:[...this.primary],cleanup:[...this.cleanup]}; }
}

// One allocation route within this module. This lease prevents this application's
// concurrent allocations; actual process-global exclusivity still requires the
// separately reviewed single-worker import/allocation graph and hosted evidence.
let leased=false;
export function claimApplicationDomain(): ()=>void {
  if(leased) throw new Error('Previous application domain has not completed cleanup');
  leased=true;
  return ()=> { if(!leased) throw new Error('Application lease already released'); leased=false; };
}
