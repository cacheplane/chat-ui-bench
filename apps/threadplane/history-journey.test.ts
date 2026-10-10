import {expect,test} from 'vitest';
const api=await import('./history-journey.js').catch(()=>({})) as any;
test('a visible historical tail at the bottom cannot validate historical reading',()=>{
 expect(typeof api.hasHistoricalCoverage).toBe('function');
 expect(api.hasHistoricalCoverage({afterGapCssPx:1,overlapGapCssPx:26,upwardMovementCssPx:100,hasAnchor:true,anchorStillVisible:true,runtimeUpdated:true})).toBe(false);
});
test('a native return click requires actual visibility, continued runtime updates and observed following',()=>{
 expect(typeof api.hasReturnedToFollowing).toBe('function');
 const valid={clicked:true,afterVisible:true,laterVisible:true,afterGapCssPx:0,laterGapCssPx:25,runtimeUpdated:true};
 expect(api.hasReturnedToFollowing(valid)).toBe(true);
 for(const patch of [{clicked:false},{afterVisible:false},{laterVisible:false},{afterGapCssPx:150},{laterGapCssPx:150},{runtimeUpdated:false}])expect(api.hasReturnedToFollowing({...valid,...patch})).toBe(false);
});
test('requires actual movement, sustained departure, the same historical anchor and further runtime updates',()=>{
 expect(typeof api.hasHistoricalCoverage).toBe('function');
 const positive={afterGapCssPx:300,overlapGapCssPx:350,upwardMovementCssPx:100,hasAnchor:true,anchorStillVisible:true,runtimeUpdated:true};
 expect(api.hasHistoricalCoverage(positive)).toBe(true);
 for(const patch of [{upwardMovementCssPx:0},{afterGapCssPx:149},{overlapGapCssPx:149},{hasAnchor:false},{anchorStillVisible:false},{runtimeUpdated:false}])expect(api.hasHistoricalCoverage({...positive,...patch})).toBe(false);
});
