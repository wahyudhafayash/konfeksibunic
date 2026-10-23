const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components/views');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/import \{ useLiveQuery \} from 'dexie-react-hooks';\nimport \{ db \} from '@\/lib\/db';/g, "import { db, useLiveQuery } from '@/lib/db';");
  fs.writeFileSync(filePath, content);
}
console.log('Done');
