/** CDP Network blocking keeps owned streams outside Fetch interception.
 * This guard owns one fresh page target; it is not a process-wide firewall. */
export const OWNED_NETWORK_POLICY=Object.freeze({
  version:'chromium-cdp-owned-origin-block-v1',
  browserProduct:'HeadlessChrome/156.0.8078.4',
  protocolVersion:'1.3',
  observationLimit:512,
});

export async function installOwnedNetworkGuard({context,page,origin,onExternal}){
  let selected;try{selected=new URL(origin);}catch{throw Error('owned-network-origin');}
  if(selected.origin!==origin||selected.protocol!=='http:'||selected.hostname!=='127.0.0.1'||!selected.port||page.url()!=='about:blank'||typeof onExternal!=='function')throw Error('owned-network-selection');
  const session=await context.newCDPSession(page);
  const version=await session.send('Browser.getVersion');
  if(version.product!==OWNED_NETWORK_POLICY.browserProduct||version.protocolVersion!==OWNED_NETWORK_POLICY.protocolVersion)throw Error('owned-network-unsupported-browser-policy');
  const requested=[],finished=[],blocked=[],ids=new Map();let overflow=false,closed=false;
  const reserve=(array,value)=>{if(array.length>=OWNED_NETWORK_POLICY.observationLimit){overflow=true;return false;}array.push(value);return true;};
  page.once('close',()=>{closed=true;});
  session.on('Inspector.detached',()=>{closed=true;});
  session.on('Network.requestWillBeSent',event=>{
    const url=event.request.url;if(typeof url!=='string'){overflow=true;return;}
    let owned=false,localResource=false;try{const parsed=new URL(url);owned=parsed.origin===origin;localResource=parsed.protocol==='data:';}catch{}
    if(!localResource&&url.length>8192){overflow=true;return;}
    const observation={requestId:event.requestId,url:localResource?url.slice(0,256):url,timestamp:event.timestamp,...(localResource?{localResource:true,urlLength:url.length}:{})};
    if(!reserve(requested,observation))return;
    ids.set(event.requestId,observation.url);
    if(localResource)return;
    if(!owned)onExternal(url);
  });
  session.on('Network.loadingFinished',event=>{
    const url=ids.get(event.requestId);if(url!==undefined)reserve(finished,{requestId:event.requestId,url,timestamp:event.timestamp,encodedDataLength:event.encodedDataLength});
  });
  session.on('Network.loadingFailed',event=>{
    const url=ids.get(event.requestId);if(url!==undefined)reserve(blocked,{requestId:event.requestId,url,timestamp:event.timestamp,errorText:String(event.errorText).slice(0,512),canceled:event.canceled??false,blockedReason:event.blockedReason??null});
  });
  await session.send('Network.enable');
  // Ordered explicit allow overrides the wildcard block in this pinned protocol.
  // Unsupported commands/parameters reject admission; no routing fallback exists.
  await session.send('Network.setBlockedURLs',{urlPatterns:[{urlPattern:origin+'/*',block:false}],urls:['*']});
  if(closed||page.isClosed())throw Error('owned-network-page-closed');
  return Object.freeze({read:()=>structuredClone({policy:OWNED_NETWORK_POLICY,browser:{product:version.product,protocolVersion:version.protocolVersion,revision:version.revision},origin,closed,overflow,requested,finished,blocked})});
}
