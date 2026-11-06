
'use strict';

const labels={todo:'할 일',doing:'진행 중',done:'완료'}, priorities={high:'높음',normal:'보통',low:'낮음'};
const $=id=>document.getElementById(id);
let tasks=[],editing=null,dragging=null,timer;
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function valid(t){return t&&typeof t.id==='string'&&typeof t.title==='string'&&t.title.trim()&&t.title.length<=150&&typeof t.description==='string'&&t.description.length<=5000&&Object.hasOwn(labels,t.status)&&Object.hasOwn(priorities,t.priority)&&typeof t.due==='string'&&(t.due===''||/^\d{4}-\d{2}-\d{2}$/.test(t.due))&&Number.isFinite(t.created)}
function notify(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.add('hidden'),3500)}
function text(tag,content,cls){const el=document.createElement(tag);el.textContent=content;if(cls)el.className=cls;return el}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function render(){
$('total').textContent=tasks.length;$('active').textContent=tasks.filter(t=>t.status==='doing').length;$('rate').textContent=tasks.length?Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100)+'%':'0%';
const query=$('search').value.trim().toLocaleLowerCase(),filter=$('priorityFilter').value;
const visible=tasks.filter(t=>(filter==='all'||t.priority===filter)&&`${t.title} ${t.description}`.toLocaleLowerCase().includes(query));
const weights={high:0,normal:1,low:2};visible.sort((a,b)=>$('sort').value==='due'?(a.due||'9999').localeCompare(b.due||'9999')||b.created-a.created:$('sort').value==='priority'?weights[a.priority]-weights[b.priority]||b.created-a.created:b.created-a.created);
$('board').replaceChildren();
for(const [status,label] of Object.entries(labels)){
const col=text('section','','column '+status);col.dataset.status=status;col.setAttribute('aria-label',label);
const head=text('div','','col-head');head.append(text('span','','dot'),text('h2',label),text('span',String(visible.filter(t=>t.status===status).length),'count'));const add=text('button','＋','add-small');add.setAttribute('aria-label',label+'에 추가');add.onclick=()=>openEditor(null,status);head.append(add);col.append(head);
const list=text('div','','cards');const group=visible.filter(t=>t.status===status);
if(!group.length)list.append(text('div',query||filter!=='all'?'조건에 맞는 할 일이 없어요.':status==='done'?'완료한 일이 여기에 모여요.':'새 할 일을 추가해 보세요.','empty'));
for(const t of group){const card=text('article','','card');card.draggable=true;card.dataset.id=t.id;
const top=text('div','','card-top');const edit=text('button','⋯','edit');edit.setAttribute('aria-label',t.title+' 수정');edit.onclick=()=>openEditor(t.id);top.append(text('span',priorities[t.priority],'badge '+t.priority),edit);card.append(top,text('h3',t.title));if(t.description)card.append(text('p',t.description));
const foot=text('div','','card-foot');const due=text('span',t.due?'◷ '+t.due:'마감일 없음');if(t.due&&t.due<today()&&t.status!=='done'){due.className='overdue';due.textContent+=' · 지연'}
const select=document.createElement('select');select.setAttribute('aria-label',t.title+' 상태 변경');for(const [v,l]of Object.entries(labels)){const opt=text('option',l);opt.value=v;select.append(opt)}select.value=t.status;select.onchange=()=>mutate('PATCH',{id:t.id,status:select.value}).catch(()=>render());foot.append(due,select);card.append(foot);
card.addEventListener('dragstart',e=>{if(e.target.closest('button,select')){e.preventDefault();return}dragging=t.id;e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';card.classList.add('dragging')});card.addEventListener('dragend',()=>{dragging=null;document.querySelectorAll('.over,.dragging').forEach(el=>el.classList.remove('over','dragging'))});list.append(card)}
col.append(list);const bottom=text('button','＋ 할 일 추가','column-add');bottom.onclick=()=>openEditor(null,status);col.append(bottom);
col.addEventListener('dragover',e=>{if(dragging){e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('over')}});col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('over')});col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('over');const task=tasks.find(t=>t.id===dragging);if(task){dragging=null;mutate('PATCH',{id:task.id,status}).catch(()=>render())}});$('board').append(col)
}}
function openEditor(id=null,status='todo'){editing=id;const t=tasks.find(t=>t.id===id);$('taskForm').reset();$('dialogTitle').textContent=t?'할 일 수정':'새 할 일';$('title').value=t?.title||'';$('description').value=t?.description||'';$('status').value=t?.status||status;$('priority').value=t?.priority||'normal';$('due').value=t?.due||'';$('delete').hidden=!t;$('editor').showModal();$('title').focus()}
$('newTask').onclick=()=>openEditor();$('cancel').onclick=()=>$('editor').close();
$('title').addEventListener('input',()=>$('title').setCustomValidity(''));
$('taskForm').onsubmit=async e=>{e.preventDefault();const title=$('title').value.trim();if(!title){$('title').setCustomValidity('제목을 입력해 주세요.');$('title').reportValidity();return}const values={title,description:$('description').value.trim(),status:$('status').value,priority:$('priority').value,due:$('due').value};try{await mutate(editing?'PATCH':'POST',editing?{id:editing,...values}:values);$('editor').close();notify('Supabase에 저장했습니다.')}catch{}};
$('delete').onclick=async()=>{if(confirm('이 할 일을 삭제할까요? 삭제 후 되돌릴 수 없습니다.')){try{await mutate('DELETE',{id:editing});$('editor').close();notify('삭제했습니다.')}catch{}}};
for(const id of ['search','priorityFilter','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),tasks},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kanban-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('백업 파일을 내보냈습니다.')};
$('import').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('파일 크기가 5MB를 초과합니다.');const data=JSON.parse(await f.text()),items=Array.isArray(data)?data:data.tasks;if(!Array.isArray(items)||!items.every(valid)||new Set(items.map(t=>t.id)).size!==items.length)throw Error('올바른 칸반 백업이 아닙니다.');if(confirm(`내 보드를 백업의 ${items.length}개 할 일로 교체할까요? 기존 목록을 먼저 내보내 주세요.`)){await mutate('PUT',{tasks:items});notify('Supabase에 백업을 복원했습니다.')}}catch(err){notify(err.message)}finally{e.target.value=''}};
let token=null,config=null,busy=false;
async function request(method,body){const r=await fetch('/api/tasks',{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){if(r.status===401)signOut();throw Error(data.error||'요청에 실패했습니다.')}return data;}
function lock(value){busy=value;document.querySelectorAll('#workspace button,#workspace select,#workspace input,#editor button,#editor input,#editor select,#editor textarea,#refresh,#logout').forEach(el=>el.disabled=value);document.querySelectorAll('.card').forEach(el=>el.draggable=!value);}
async function load(){const data=await request('GET');tasks=data;render();$('saveStatus').textContent='Supabase에서 불러옴 · 상태 변경은 서버에 저장됩니다.';}
async function mutate(method,body){if(busy)throw Error('저장 중입니다.');lock(true);try{const data=await request(method,body);tasks=data;render();$('saveStatus').textContent='Supabase 저장 완료 · '+new Date().toLocaleTimeString();}catch(err){$('saveStatus').textContent='저장 실패 · 변경사항을 저장하지 못했습니다.';notify(err.message);throw err;}finally{lock(false);}}
function signOut(){token=null;tasks=[];render();$('editor').close();$('workspace').hidden=true;$('authPanel').hidden=false;$('logout').hidden=true;$('refresh').disabled=true;$('accountEmail').textContent='';}
async function authenticate(signup=false){if(!config){notify('서버 설정을 확인해 주세요.');return}const email=$('email').value.trim(),password=$('password').value;if(!$('authForm').reportValidity())return;const buttons=$('authForm').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{const response=await fetch(config.url+'/auth/v1/'+(signup?'signup':'token?grant_type=password'),{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await response.json();if(!response.ok)throw Error(data.msg||data.error_description||data.message||'인증 실패');if(!data.access_token){notify('가입 확인 이메일을 확인한 뒤 로그인해 주세요.');return}token=data.access_token;$('password').value='';await load();$('workspace').hidden=false;$('authPanel').hidden=true;$('logout').hidden=false;$('refresh').disabled=false;$('accountEmail').textContent=email;}catch(err){signOut();notify(err.message)}finally{buttons.forEach(b=>b.disabled=false)}}
$('authForm').onsubmit=e=>{e.preventDefault();authenticate()};$('signup').onclick=()=>authenticate(true);$('logout').onclick=async()=>{const old=token;signOut();if(old&&config)try{await fetch(config.url+'/auth/v1/logout',{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+old}})}catch{}};
$('refresh').onclick=async()=>{if(busy)return;lock(true);try{await load()}catch(err){notify(err.message)}finally{lock(false)}};
fetch('/api/config').then(async r=>{if(!r.ok)throw Error('Vercel의 Supabase 환경 변수를 설정해 주세요.');config=await r.json()}).catch(err=>notify(err.message));render();
