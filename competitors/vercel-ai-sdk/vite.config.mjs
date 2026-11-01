import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('.',import.meta.url)).replace(/\/$/,'');
const sha=value=>createHash('sha256').update(value).digest('hex');
export default defineConfig({root,build:{sourcemap:false,target:'es2022'},plugins:[{
  name:'isolated-vercel-profile',generateBundle(_options,bundle){
    const modules=[];
    for(const raw of this.getModuleIds()){
      const id=raw.split('?')[0];if(!id.startsWith('/')||!id.includes('/node_modules/'))continue;
      const actual=realpathSync(id);if(!actual.startsWith(root+'/node_modules/'))throw Error('vercel-cross-environment-module:'+actual);
      modules.push(actual.slice(root.length+1));
    }
    const packages={};for(const name of ['@ai-sdk/react','ai','react','react-dom'])packages[name]=JSON.parse(readFileSync(root+'/node_modules/'+name+'/package.json','utf8')).version;
    const assets=Object.fromEntries(Object.entries(bundle).map(([name,item])=>{const bytes=Buffer.from(item.type==='chunk'?item.code:item.source);return[name,{bytes:bytes.length,sha256:sha(bytes)}];}));
    this.emitFile({type:'asset',fileName:'profile-build.json',source:JSON.stringify({schema:1,profile:'vercel-ai-sdk',renderer:'benchmark-owned plain-text renderer, bottom-follow and return control',packages,lockSha256:sha(readFileSync(root+'/package-lock.json')),modules:modules.sort(),assets,FPS:null,scoringEligibility:false},null,2)+'\n'});
  },
}]});
