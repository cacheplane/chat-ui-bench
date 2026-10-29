import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './prepare-owner-stock033-v2.mjs';
import {serializeStock033DataV2} from './prepare-stock033-v2.mjs';
test('request-window owner has separate fixed-profile selection before source work',async()=>{
 for(const key of ['generateStock033RequestWindowPreparationInputsV1','runStock033RequestWindowPreparationOwnerV1','createStock033RequestWindowOwnerAuthoredControlV1'])assert.equal(typeof api[key],'function',key);
 for(const fixtureProfile of ['foreign',undefined,1000]){
  await assert.rejects(api.generateStock033RequestWindowPreparationInputsV1({fixtureProfile}));
  await assert.rejects(api.runStock033RequestWindowPreparationOwnerV1({fixtureProfile}));
 }
 const authored=api.createStock033RequestWindowOwnerAuthoredControlV1('native-history10000-v1');
 const result=authored.resultEnvelope('x');assert.equal(result.fixtureProfile,'native-history10000-v1');assert.equal(result.inputRecipe,'native-stock033-request-window-scroll-v1');
 assert.equal(result.authoredControl,true);
 const request=authored.requestEnvelope('/private/tmp/c');assert.equal(request.request.type,'prepare-request-window-scroll-v1');assert.equal(request.request.fixtureProfile,'native-history10000-v1');
});
test('request-window option admission retains original generation capability and independently copies config DTO',()=>{
 const control=api.createStock033RequestWindowOwnerAuthoredControlV1('native-history100-v1'),generation={config:{path:'/private/tmp/config',fact:{bytes:1}}};
 const input={fixtureProfile:'native-history100-v1',config:generation.config,generation};
 const selected=control.selectOwnerOptions(input);
 assert.equal(selected.generation,generation);assert.notEqual(selected.config,input.config);assert.deepEqual(selected.config,input.config);
});
test('request-window owner selection refuses proxy before own-property probing',async()=>{
 let probes=0;const input=new Proxy({},{getOwnPropertyDescriptor(){probes++;throw Error('proxy-probe');}});
 await assert.rejects(api.runStock033RequestWindowPreparationOwnerV1(input));assert.equal(probes,0);
});
test('maintained owner new ledger constructors preserve exact serializer selection across transfer',()=>{
 const control=api.createStock033RequestWindowOwnerAuthoredControlV1('native-history100-v1'),ledger=control.requestLedger(),zero=ledger.totals();
 const transferred=control.transferRequestLedger({totals:zero,platformSetSha256:null,reservation:zero});
 const bytes=serializeStock033DataV2({a:'x'},1024,transferred);assert.equal(transferred.totals().serializedBytes,bytes.length);
});
