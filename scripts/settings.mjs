import fs from 'node:fs';
export function readSettings(required=false){
 const path=new URL('../tracker.config.json',import.meta.url);
 if(!fs.existsSync(path)){if(required)throw new Error('Copy tracker.config.example.json to tracker.config.json and fill in your settings.');return {};}
 return JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
}
