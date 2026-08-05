const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
let count = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('toast.success(')) {
    const newContent = content.replace(/toast\.success\(/g, 'console.log(');
    fs.writeFileSync(file, newContent, 'utf8');
    count++;
    console.log('Updated', file);
  }
});

console.log(`Replaced toast.success in ${count} files.`);
