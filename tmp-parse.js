const {JSDOM}=require('jsdom');
const mammoth=require('mammoth');
(async()=>{
 const {value:html}=await mammoth.convertToHtml({path:'H:/report.docx'});
 const doc=new JSDOM(html).window.document;
 const tables=doc.querySelectorAll('table');
 const normalizeName=(raw)=>raw.replace(/^[0-9０-９]+[\.．、﹒﹑]?/, '').replace(/[:：]/g,'').replace(/\s+/g,'').trim();
 const splitNames=(raw)=>raw.split(/(?=[0-9０-９]+[\.．、﹒﹑]?)/).map(normalizeName).filter(Boolean);
 const parse=()=>{
  if(!tables.length) return null;
  const attTable=tables[0];
  const attRows=[...attTable.querySelectorAll('tr')];
  const preview=[]; const nameMap=new Map();
  let headerFound=false; let parsingNotes=false; let noteColumnIndex=-1;
  for(const rowEl of attRows){
    const cells=[...rowEl.querySelectorAll('td,th')].map(c=>c.textContent.trim());
    const firstCell=cells[0];
    if(['組員近況','關懷名單','小組長近況'].some(k=>firstCell.includes(k))){
      if(firstCell.includes('組員近況')) parsingNotes=true;
      continue;
    }
    if(!parsingNotes && !headerFound){
      const isDateRow=cells.slice(1).some(c=>/(\d{1,2})[月\.](\d{1,2})/.test(c));
      if(isDateRow || preview.length===0){
        headerFound=true;
        noteColumnIndex=cells.length;
        preview.push([...cells,'出席狀況/備註']);
        continue;
      }
    }
    if(parsingNotes){
      const names=splitNames(firstCell);
      const note=cells.slice(1).join(' ').trim();
      names.forEach(name=>{
        const rowIndex=nameMap.get(name);
        if(rowIndex!==undefined && note){
          const existing=preview[rowIndex];
          if(noteColumnIndex===-1){ noteColumnIndex=existing.length; if(preview[0]) preview[0].push('出席狀況/備註'); }
          while(existing.length<=noteColumnIndex) existing.push('');
          const cur=existing[noteColumnIndex];
          if(!(cur && cur.includes(note))) existing[noteColumnIndex]=cur? (cur+'; '+note): note;
        }
      });
    } else {
      if(!firstCell || firstCell.length>20 || ['總計','出席','統計'].some(k=>firstCell.includes(k))) continue;
      const isStatusRow=(firstCell.length>5 && /[\u4e00-\u9fa5]/.test(firstCell)) || ['狀況','事項','代禱','備註'].some(k=>firstCell.includes(k));
      if(isStatusRow && preview.length>1){
        const last=preview[preview.length-1];
        const content=cells.filter(c=>c).join(' ');
        if(content) last[last.length-1]=(last[last.length-1]+' '+content).trim();
        continue;
      }
      const normalized=normalizeName(firstCell);
      if(nameMap.has(normalized)) continue;
      const row=[normalized, ...cells.slice(1)];
      if(noteColumnIndex!==-1){ while(row.length<=noteColumnIndex) row.push(''); }
      preview.push(row);
      nameMap.set(normalized, preview.length-1);
    }
  }
  if(!headerFound || (preview[0]?.length||0)<=2) return null;
  return preview;
 };
 const preview=parse();
 console.log('header', preview && preview[0]);
 console.log('rows', preview && preview.length);
 if(preview) console.log(preview.slice(0,6));
})();
