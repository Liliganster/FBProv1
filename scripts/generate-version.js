import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, '../public/version.json');

const versionData = {
    buildTime: new Date().toISOString(),
    commitHash: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'dev',
};

fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

console.log('✅ Version file generated at public/version.json');
console.log(versionData);
