const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgPath = path.join(os.homedir(), 'AppData', 'Roaming', 'hatch', 'config');
const cfg = fs.readFileSync(cfgPath, 'utf8');
const base = cfg.match(/^HATCH_BASE=(.*)$/m)[1].trim();
const key = cfg.match(/^HATCH_KEY=(.*)$/m)[1].trim();

const [method, urlPath, bodyFile] = process.argv.slice(2);
const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : undefined;

fetch(base + urlPath, {
  method,
  headers: {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  },
  body,
}).then(async (res) => {
  const text = await res.text();
  console.log('STATUS', res.status);
  console.log(text);
});
