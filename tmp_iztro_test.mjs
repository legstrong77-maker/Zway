import { astro } from 'iztro';
import fs from 'fs';

const ast = astro.bySolar('1986-10-01', 1, '男', true, 'zh-TW');

let output = '';
output += '--- AST Center Info ---\n';
output += 'Life Master: ' + ast.lifeMaster + '\n';
output += 'Body Master: ' + ast.bodyMaster + '\n';

const palace = ast.palaces[0];
output += '\n--- Palace 0 Info ---\n';
output += JSON.stringify(palace, null, 2) + '\n';

output += '\n--- AST keys ---\n';
output += Object.keys(ast).join(', ') + '\n';

output += '\n--- Horoscope methods if any ---\n';
if (ast.horoscope) {
  const h = ast.horoscope(new Date().toISOString().split('T')[0]);
  output += JSON.stringify(h, null, 2);
}

fs.writeFileSync('iztro_output.txt', output);
