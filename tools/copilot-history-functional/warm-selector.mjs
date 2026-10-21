// Private source-owned capabilities and transferred vectors only. No application reads.
// The caller relinquishes flat/mask/keys; mask is scratch and is not cloned.
export function createWarmSelector({calculateRangeImpl,defaultRangeExtractor}){
 function prepare({flat,mask,keys,viewport,overscan}){
  let calls=0;
  function unavailable(reason){return Object.freeze({status:'unavailable',reason,gapStart:null,gapEnd:null,partition:null,targets:'',finalLow:null,finalHigh:null,steps:0,rangeCalls:calls});}
  const real=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
  if(!Array.isArray(flat)||flat.length!==200||!Array.isArray(mask)||mask.length!==100||!Array.isArray(keys)||keys.length!==100||!real(viewport,Number.MIN_VALUE,1e7)||!Number.isSafeInteger(overscan)||overscan<0||overscan>10)return unavailable('invalid-input');
  let end=0;
  for(let i=0;i<100;i++){
   const start=flat[2*i],size=flat[2*i+1],m=mask[i];
   if(!real(start,0,1e7)||start!==end||!real(size,1,1e7)||!Number.isSafeInteger(m)||m<0||m>15||m&2&&!(m&1)||m&8&&(m&6)!==6||keys[i]!=='history-'+i)return unavailable('invalid-input');
   end=start+size;if(end>1e7)return unavailable('invalid-input');
  }
  const maximumOffset=Math.max(0,end-viewport);
  function range(target){
   if(calls===24)return null;calls++;
   const offset=Math.min(flat[2*target],maximumOffset);
   const r=calculateRangeImpl({length:100},viewport,offset,1,flat);
   return defaultRangeExtractor({...r,count:100,lanes:1,overscan});
  }
  let gapStart=-1,gapEnd=-1,gaps=0;
  for(let i=0;i<100;){
   if(mask[i]&3){i++;continue;}
   const start=i;while(i<100&&!(mask[i]&3))i++;
   const last=i-1;if(last-start+1<16)continue;
   if(++gaps>6)return unavailable('gap-capacity');
   if(last-start>gapEnd-gapStart){gapStart=start;gapEnd=last;}
  }
  if(gapStart<0)return unavailable('no-gap');
  const partition=Math.floor((gapStart+gapEnd)/2);let bottom;
  {
   const first=range(partition);if(first===null)return unavailable('range-capacity');
   const low=first[0],high=first[first.length-1];bottom=high+1+overscan;
   // Reject clamp before the second extractor allocates any candidate vector.
   if(low<gapStart||high>gapEnd||bottom>=100||flat[2*bottom]>maximumOffset)return unavailable('unsafe-join');
   const second=range(bottom);if(second===null)return unavailable('range-capacity');
   if(second[0]!==high+1||first.length+second.length>100)return unavailable('unsafe-join');
  }
  const targets=[];
  for(let x=99;x>bottom;x-=10){if(targets.length===12)return unavailable('step-capacity');targets.push(x);}
  if(targets.length===12)return unavailable('step-capacity');targets.push(bottom);
  for(let x=0;x<partition;x+=10){if(targets.length===12)return unavailable('step-capacity');targets.push(x);}
  if(targets.length===12)return unavailable('step-capacity');targets.push(partition);
  let previousLow=-1,previousHigh=-1,finalLow=-1,finalHigh=-1;
  for(const target of targets){
   const next=range(target);if(next===null)return unavailable('range-capacity');
   const low=next[0],high=next[next.length-1];
   for(let i=0;i<100;i++){
    const retained=previousLow<0?Boolean(mask[i]&4):i>=previousLow&&i<=previousHigh;
    if(i<low||i>high){mask[i]&=~(4|8|32);continue;}
    if(!retained){if(mask[i]&3||mask[i]&16)mask[i]&=~(8|32);else mask[i]|=32;}
    mask[i]|=4|16;
   }
   previousLow=low;previousHigh=high;finalLow=low;finalHigh=high;
  }
  for(let i=0;i<100;i++)if(!(mask[i]&2)&&((mask[i]&1)||!(mask[i]&16)))return unavailable('coverage-gap');
  for(let i=finalLow;i<=finalHigh;i++)if(!(mask[i]&8)&&!(mask[i]&32))return unavailable('final-cached-remount');
  return Object.freeze({status:'prepared-structural-only',reason:null,gapStart,gapEnd,partition,targets:targets.join(','),finalLow,finalHigh,steps:targets.length,rangeCalls:calls});
 }
 return Object.freeze({prepare});
}
