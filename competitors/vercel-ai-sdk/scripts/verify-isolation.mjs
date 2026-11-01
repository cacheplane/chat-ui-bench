import {readFileSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const expected={'@ai-sdk/react':'4.0.163',ai:'7.0.159',react:'19.3.1','react-dom':'19.3.1','@types/node':'24.10.1','@types/react':'19.3.0','@types/react-dom':'19.3.0',jsdom:'30.1.3',typescript:'7.0.2',vite:'8.3.4'};
const manifest=JSON.parse(readFileSync(root+'/package.json','utf8')),lock=JSON.parse(readFileSync(root+'/package-lock.json','utf8'));
if(manifest.name!=='@chat-ui-bench/vercel-ai-sdk-functional'||lock.lockfileVersion!==3)throw Error('own-dependency-profile');
const declared={...manifest.dependencies,...manifest.devDependencies},locked={...lock.packages[''].dependencies,...lock.packages[''].devDependencies};
if(JSON.stringify(Object.keys(declared).sort())!==JSON.stringify(Object.keys(expected).sort()))throw Error('own-dependency-roster');
for(const[name,version]of Object.entries(expected)){
  let resolved;try{resolved=realpathSync(root+'/node_modules/'+name+'/package.json');}catch{throw Error('own-dependency-missing:'+name);}
  if(!resolved.startsWith(root+'/node_modules/'))throw Error('own-dependency-location:'+name);
  const installed=JSON.parse(readFileSync(resolved,'utf8')),record=lock.packages['node_modules/'+name];
  if(declared[name]!==version||locked[name]!==version||installed.version!==version||record?.version!==version||typeof record.integrity!=='string')throw Error('own-dependency-pin:'+name);
}
for(const command of ['vite','tsc'])if(!realpathSync(root+'/node_modules/.bin/'+command).startsWith(root+'/node_modules/'))throw Error('own-dependency-tool:'+command);
console.log('Verified exact independent Vercel SDK, tool and lock roots');
