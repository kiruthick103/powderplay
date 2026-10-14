const fs = require('fs');
const content = fs.readFileSync('./assets/unicornStudio.umd.js', 'utf8');
const regex = /qe\("([^"]+)"\)/g;
let match;
while ((match = regex.exec(content)) !== null) {
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    console.log(match[1], '->', decoded);
  } catch(e) {}
}
