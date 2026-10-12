import {test,expect} from 'vitest';
import * as contract from './index.js';
test('installer schemas are shared strict data schemas with exact runtime literals and bounded run identity',()=>{
  expect(contract.preNavigationOptionsSchema).toBeDefined();expect(contract.mainOptionsSchema).toBeDefined();
  const identity={repetition:'r',round:1,artifactDirectory:'runs/r',scenarioId:'s',caseIndex:0,adapterProfile:'p',seed:1,mode:'headless'},common={optionsVersion:1,identity,limits:contract.COMPARISON_CAPTURE_LIMITS},pre={...common,stateGlobal:'comparisonPreNavigation'},main={...common,probeIntervalMs:50,bridgeGlobal:'benchHost',stateGlobal:'comparisonCapture',preNavigationGlobal:'comparisonPreNavigation',observers:{eventTiming:{buffered:true,durationThresholdMs:16},loaf:{buffered:true}},nativeRecipeIds:{wheel:'comparison-wheel-up-v1',composer:'comparison-composer-calibrate-v1'}};
  expect(contract.preNavigationOptionsSchema.parse(pre)).toEqual(pre);expect(contract.mainOptionsSchema.parse(main)).toEqual(main);
  for(const value of [{...pre,extra:1},{...pre,identity:{...identity,extra:1}},{...pre,identity:{...identity,round:0}},{...pre,identity:{...identity,seed:Number.MAX_SAFE_INTEGER+1}},{...pre,identity:{...identity,repetition:'r'.repeat(257)}},{...pre,identity:{...identity,artifactDirectory:'../r'}},{...pre,limits:{...pre.limits,maxRecordTokens:65535}}])expect(contract.preNavigationOptionsSchema.safeParse(value).success).toBe(false);
  for(const value of [{...main,probeIntervalMs:51},{...main,bridgeGlobal:'other'},{...main,observers:{...main.observers,eventTiming:{buffered:true,durationThresholdMs:17}}},{...main,nativeRecipeIds:{...main.nativeRecipeIds,wheel:'unused'}},{...main,observers:{...main.observers,extra:{}}}])expect(contract.mainOptionsSchema.safeParse(value).success).toBe(false);
});


// The new family is deliberately accessed through the existing index namespace.
type OptionsFamily={preNavigationOptionsSchema:{parse(value:unknown):unknown};mainOptionsSchema:{parse(value:unknown):unknown;safeParse(value:unknown):{success:boolean}}};
function optionsFamily(version:string):OptionsFamily {
  const lookup=Reflect.get(contract,'comparisonSchemasForVersionPair');
  expect(typeof lookup,'planned closed family API, not a missing module').toBe('function');
  return (lookup as (pair:{collectorVersion:string;analyzerVersion:string})=>OptionsFamily)({collectorVersion:version,analyzerVersion:version});
}
function migrationOptions(){
  // Exact data fixture copied from the existing installer-options test above.
  const identity={repetition:'r',round:1,artifactDirectory:'runs/r',scenarioId:'s',caseIndex:0,adapterProfile:'p',seed:1,mode:'headless'},common={optionsVersion:1,identity,limits:contract.COMPARISON_CAPTURE_LIMITS},pre={...common,stateGlobal:'comparisonPreNavigation'},main={...common,probeIntervalMs:50,bridgeGlobal:'benchHost',stateGlobal:'comparisonCapture',preNavigationGlobal:'comparisonPreNavigation',observers:{eventTiming:{buffered:true,durationThresholdMs:16},loaf:{buffered:true}},nativeRecipeIds:{wheel:'comparison-wheel-up-v1',composer:'comparison-composer-calibrate-v1'}};
  return {pre,main};
}
const freshSamplingPolicy=()=>({mode:'fresh-page-acquisition',minimumPostToLaterPageMs:800,maxWaitCallbacks:64});
test('legacy options remain exact; new policy is not inferred from structural presence',()=>{
  const {pre,main}=migrationOptions(),before=JSON.stringify({pre,main});
  expect(contract.preNavigationOptionsSchema.parse(pre)).toEqual(pre);expect(contract.mainOptionsSchema.parse(main)).toEqual(main);
  expect(contract.mainOptionsSchema.safeParse({...main,scoredScrollSampling:freshSamplingPolicy()}).success).toBe(false);
  expect(optionsFamily('2.0.0').mainOptionsSchema.parse(main)).toEqual(main);
  expect(optionsFamily('2.0.0').mainOptionsSchema.safeParse({...main,scoredScrollSampling:freshSamplingPolicy()}).success).toBe(false);
  expect(JSON.stringify({pre,main})).toBe(before);
});
test('new family requires the exact fresh sampling policy without altering pre-navigation or native recipes',()=>{
  const family=optionsFamily('2.1.0'),{pre,main}=migrationOptions(),value={...main,scoredScrollSampling:freshSamplingPolicy()};
  expect(family.preNavigationOptionsSchema.parse(pre)).toEqual(pre);
  expect(family.mainOptionsSchema.parse(value)).toEqual(value);
  expect(family.mainOptionsSchema.safeParse(main).success).toBe(false);
  for(const patch of [{mode:'cached'},{minimumPostToLaterPageMs:799},{minimumPostToLaterPageMs:801},{maxWaitCallbacks:63},{maxWaitCallbacks:65},{extra:true},{intervalMs:50}])expect(family.mainOptionsSchema.safeParse({...value,scoredScrollSampling:{...freshSamplingPolicy(),...patch}}).success).toBe(false);
  for(const mutate of [
    {...value,optionsVersion:2},
    {...value,probeIntervalMs:51},
    {...value,nativeRecipeIds:{...value.nativeRecipeIds,wheel:'new-wheel'}},
    {...value,limits:{...value.limits,maxRectsPerSample:2049}},
  ])expect(family.mainOptionsSchema.safeParse(mutate).success).toBe(false);
});
