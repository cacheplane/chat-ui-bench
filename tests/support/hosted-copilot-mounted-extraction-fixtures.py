import pathlib,subprocess,zipfile,tempfile,stat,json,hashlib,shutil,sys,warnings
# Supplied ZIP data only; no bootstrap action or application is invoked.
source_path,selected=sys.argv[1:]
source=pathlib.Path(source_path).read_text()
body=source.split('const extractSource=String.raw`\n',1)[1].split('\n`;',1)[0]+'\n'
root=pathlib.Path(tempfile.mkdtemp(prefix='chat-ui-bench-zip-synthetic-')); results=[]
def run(name,items,valid=False,corrupt=False):
 if name!=selected:return
 archive=root/(name+'.zip');destination=root/(name+'-out')
 with warnings.catch_warnings():
  warnings.simplefilter('ignore',UserWarning)
  with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
   for path,data,mode in items:
    i=zipfile.ZipInfo(path);i.create_system=3;i.external_attr=mode<<16;z.writestr(i,data)
 if corrupt:
  b=bytearray(archive.read_bytes());p=b.index(b'PK\x01\x02');b[p+16:p+20]=b'\x00'*4;archive.write_bytes(b)
 p=subprocess.run([sys.executable,'-I','-S','-B','-c',body,str(archive),str(destination)],capture_output=True,timeout=10)
 good=p.returncode==0 if valid else p.returncode!=0 and (destination.exists() if corrupt else not destination.exists())
 if valid and p.returncode==0:
  report=json.loads(p.stdout);good=good and report['bytes']==sum(len(data) for _,data,mode in items if stat.S_IFMT(mode)==stat.S_IFREG)
  for path,data,mode in items:
   if stat.S_IFMT(mode)==stat.S_IFREG:good=good and (destination/path).read_bytes()==data
 results.append({'name':name,'passed':good,'exitCode':p.returncode,'destinationExists':destination.exists(),'stdoutBytes':len(p.stdout),'stderrBytes':len(p.stderr)})
try:
 run('implicit-directory-overflow',[(str(n)+'/'+'/'.join('a'+str(i) for i in range(60))+'/',b'',stat.S_IFDIR|0o755) for n in range(70)])
 run('file-parent-conflict',[('a',b'x',stat.S_IFREG|0o600),('a/b',b'y',stat.S_IFREG|0o600)])
 run('long-normalized-name',[('/'.join('a'*40 for _ in range(26)),b'x',stat.S_IFREG|0o600)])
 run('directory-mode-on-file-name',[('a',b'x',stat.S_IFDIR|0o755)])
 run('regular-mode-on-directory-name',[('a/',b'',stat.S_IFREG|0o600)])
 run('duplicate-normalized-name',[('a/',b'',stat.S_IFDIR|0o755),('a',b'x',stat.S_IFREG|0o600)])
 run('file-count-overflow',[(str(n),b'',stat.S_IFREG|0o600) for n in range(1153)])
 run('complete-admitted',[('nested/',b'',stat.S_IFDIR|0o755),('nested/a',b'complete bytes\x00',stat.S_IFREG|0o600),('b',b'second',stat.S_IFREG|0o600)],True)
 run('bad-crc',[('a',b'actual bytes',stat.S_IFREG|0o600)],False,True)
 assert len(results)==1,'Unknown exact synthetic case'
 report={**results[0],'syntheticOnly':True,'python':sys.version,'extractorSha256':hashlib.sha256(body.encode()).hexdigest()}
 print(json.dumps(report));sys.exit(0 if report['passed'] else 1)
finally:shutil.rmtree(root)
