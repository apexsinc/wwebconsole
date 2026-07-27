const fs = require('fs');
const file = 'src/components/ConfigNavbar.tsx';
let content = fs.readFileSync(file, 'utf8');

const start = content.indexOf('{isOpen && (');
const end = content.lastIndexOf('</>');
if (start !== -1 && end !== -1) {
  const before = content.substring(0, start);
  let modal = content.substring(start, end);
  const after = content.substring(end);

  modal = modal.replace(/bg-\[#0e111a\]\/40/g, 'bg-slate-800/50');
  modal = modal.replace(/bg-black\/60/g, 'bg-slate-900/60');
  modal = modal.replace(/border-white\/10/g, 'border-white/20');
  modal = modal.replace(/bg-gray-950\/40/g, 'bg-slate-900/30');
  modal = modal.replace(/bg-gray-950\/60/g, 'bg-slate-900/40');
  modal = modal.replace(/bg-gray-950/g, 'bg-slate-900/50');
  modal = modal.replace(/border-gray-900\/60/g, 'border-white/10');
  modal = modal.replace(/border-gray-900/g, 'border-white/10');
  modal = modal.replace(/border-gray-800/g, 'border-white/10');
  modal = modal.replace(/bg-gray-900/g, 'bg-slate-800/60');
  modal = modal.replace(/bg-gray-800/g, 'bg-slate-700/70');
  modal = modal.replace(/text-gray-400/g, 'text-slate-300');
  modal = modal.replace(/text-gray-500/g, 'text-slate-400');
  modal = modal.replace(/text-gray-600/g, 'text-slate-400');

  fs.writeFileSync(file, before + modal + after);
  console.log('Modal styling updated!');
} else {
  console.error('Could not find modal block');
}
