const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function page(reader=true){
 const elements=new Map();let writes=0;
 const element=()=>({value:'',hidden:true,disabled:false,files:[],textContent:'',addEventListener(){},appendChild(){},replaceChildren(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const row={Date:'2026-09-14',Site:'MB2','Staff Name':'Engr Bayo',Role:'Project Manager','Salary Month':'2026-09',Amount:150000,'Payment Method':'',Description:'Cashbook salary'};
 const ctx={Auth:{requireRole:async()=>({role:'Admin'})},Layout:{build(){},mainMount:()=>({innerHTML:''}),toggleSidebar(){}},document:{getElementById:el,createElement:element},API_URL:'https://example.test',Api:{getSites:async()=>({sites:[]})},localStorage:{getItem:()=>''},URL,AbortController,setTimeout:()=>0,clearTimeout(){},fetch:async url=>{const u=new URL(url);if(u.searchParams.has('payload')){writes++;return{ok:true,json:async()=>({success:true,added:1,skipped:0})};}return{ok:true,json:async()=>({entries:[]})};}};
 if(reader)ctx.XLSX={read:()=>({Sheets:{Salaries:{}},SheetNames:['Salaries']}),utils:{sheet_to_json:(_,options)=>options.header?[Object.keys(row)]:[row]}};
 await vm.runInNewContext(fs.readFileSync('bus-version3.6/js/salaries.js','utf8'),ctx);
 el('salaryFile').files=[{name:'Salaries.xlsx',arrayBuffer:async()=>new ArrayBuffer(0)}];
 return{el,writes:()=>writes};
}
test('file selection previews rows and total without writing; confirmation writes once',async()=>{
 const p=await page();await p.el('salaryFile').onchange();assert.equal(p.writes(),0);
 assert.equal(p.el('salaryImportPreview').hidden,false);assert.equal(p.el('salaryConfirmImport').hidden,false);assert.match(p.el('salaryStatus').textContent,/150,000/);
 await p.el('salaryConfirmImport').onclick();assert.equal(p.writes(),1);assert.match(p.el('salaryStatus').textContent,/1 salaries saved/);assert.equal(p.el('salaryConfirmImport').hidden,true);
});
test('missing spreadsheet reader shows a persistent error without saving',async()=>{
 const p=await page(false);await p.el('salaryFile').onchange();assert.match(p.el('salaryStatus').textContent,/Excel reader could not load/);assert.equal(p.el('salaryStatus').hidden,false);assert.equal(p.writes(),0);
});
