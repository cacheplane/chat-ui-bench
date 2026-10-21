// Fixed SOURCE-ONLY study itinerary. Ports are finite fake-native fixture ports.
// No selectors, measurement calls, cache writes, or original/browser entry point.
const stops=Object.freeze([0,1/7,2/7,3/7,4/7,5/7,6/7,1]);
export function createWarmController(){let started=false;return async function run({range,scrollTo,raf}){if(started)throw Error('warm-controller-used');started=true;for(const fraction of stops){const max=range();if(!Number.isFinite(max)||max<0||max>1e7)throw Error('warm-controller-range');scrollTo(max*fraction);await new Promise(resolve=>raf(resolve));}return{stops:8,frames:8,nativeGO:false,qualified:false};};}
