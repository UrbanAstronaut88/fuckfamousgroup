import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const history = process.argv.includes('--history');
const staged = process.argv.includes('--staged');
const build = process.argv.includes('--build');
const siteRepo = process.argv.includes('--site-repo');
const gitArgs = siteRepo ? ['--git-dir='+path.join(project,'.sites-runtime/source.git'),'--work-tree='+project] : [];
let gitCwd = project;
const git = (args, options={}) => execFileSync('git',[...gitArgs,...args],{cwd:gitCwd,maxBuffer:128*1024*1024,...options});
const root = siteRepo ? project : git(['rev-parse','--show-toplevel']).toString().trim();
gitCwd = root;
const known = new Set();
for(const name of ['.dev.vars','.env','.sites-runtime/local-auth.json','.sites-runtime/admin-access.txt','.sites-runtime/admin-initial.env']) {
  const file=path.join(project,name); if(!fs.existsSync(file))continue;
  const text=fs.readFileSync(file,'utf8');
  for(const token of text.match(/\b[a-f0-9]{64}\b/g)||[])known.add(token);
  for(const match of text.matchAll(/^(?:ADMIN_SECRET|ADMIN_SETUP_TOKEN|TELEGRAM_BOT_TOKEN|NOTIFICATION_SECRET)\s*=\s*["']?([^\s"']{16,})/gm))known.add(match[1]);
}
const blockedPath=/(?:^|\/)(?:\.env(?:\..+)?|\.dev\.vars(?:\..+)?|\.aws|\.sites-runtime|\.wrangler|node_modules|dist|\.idea)(?:\/|$)|\.(?:pem|key|p12|pfx|sqlite(?:3)?|db|tar\.gz)$|(?:admin-access.*\.txt|local-auth.*\.json)$/i;
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/,/\bAKIA[0-9A-Z]{16}\b/,/\b\d{8,12}:[A-Za-z0-9_-]{35}\b/,/(?:ADMIN_SECRET|ADMIN_SETUP_TOKEN|TELEGRAM_BOT_TOKEN|NOTIFICATION_SECRET)\s*[:=]\s*["'][A-Za-z0-9_:/+.-]{24,}["']/];
const issues=[], warnings=[];let checked=0;
function scan(name,bytes,where){
  if(blockedPath.test(name)&&!/(?:^|\/)\.env\.(?:example|sample)$/.test(name)) {
    const oldEditorFile = where.startsWith('history ') && /(?:^|\/)\.idea\//.test(name);
    (oldEditorFile ? warnings : issues).push({file:name,where,reason:'private/generated file'});
  }
  if(bytes.length>2*1024*1024||bytes.includes(0))return;
  checked++;const text=bytes.toString('utf8');
  if([...known].some(v=>text.includes(v))||patterns.some(p=>p.test(text)))issues.push({file:name,where,reason:'possible credential (value redacted)'});
}
if(build){
  const visit = directory => { for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isSymbolicLink())throw Error('Unexpected symlink in release');
    if(entry.isDirectory())visit(file);else {
      const bytes=fs.readFileSync(file);
      // Check known local values even in large bundles; generic matching also scans all text bundles.
      if([...known].some(value=>bytes.includes(Buffer.from(value))))issues.push({file:path.relative(project,file),where:'build',reason:'local credential (redacted)'});
      scan(path.relative(path.join(project,'dist'),file).replaceAll('\\','/'),bytes,'build');
    }
  }};
  visit(path.join(project,'dist'));
}else if(staged){
  const entries=git(['ls-files','--stage','-z']).toString().split('\0').filter(Boolean);
  for(const entry of entries){const [metadata,name]=entry.split('\t');const sha=metadata.split(' ')[1];scan(name,git(['cat-file','blob',sha]),'index');}
}else{
  const names=new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean));
  for(const name of names){const full=path.join(root,name);if(fs.existsSync(full)&&fs.statSync(full).isFile())scan(name,fs.readFileSync(full),'working tree');}
}
if(history){
  const lines=git(['rev-list','--objects','--all']).toString().trim().split('\n').filter(Boolean);
  if(lines.length){const meta=git(['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],{input:lines.map(l=>l.split(' ')[0]).join('\n')+'\n'}).toString().trim().split('\n');
    const objects=meta.map((line,i)=>({parts:line.split(' '),name:lines[i].slice(41)})).filter(x=>x.parts[1]==='blob'&&Number(x.parts[2])<=2*1024*1024);
    const data=git(['cat-file','--batch'],{input:objects.map(x=>x.parts[0]).join('\n')+'\n'});let offset=0;
    for(const object of objects){const end=data.indexOf(10,offset);const size=Number(data.subarray(offset,end).toString().split(' ')[2]);offset=end+1;scan(object.name,data.subarray(offset,offset+size),'history '+object.parts[0].slice(0,12));offset+=size+1;}
  }
}
if(issues.length){console.error(JSON.stringify({status:'FAIL',checked,findings:issues,warnings},null,2));process.exitCode=1;}else console.log(JSON.stringify({status:'PASS',checked,history,staged,warnings,note:'Known local credentials, credential patterns and private paths; not a guarantee against every possible secret.'}));
