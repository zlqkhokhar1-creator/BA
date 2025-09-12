const fs = require('fs');
const path = require('path');

const requiredDependencies = [
  'next',
  'react',
  'react-dom',
  'typescript'
];

function verifyDependencies() {
  console.log('🔍 Verifying dependencies...');
  
  const webPortalPackageJson = path.join(__dirname, '../apps/web-portal/package.json');
  
  if (!fs.existsSync(webPortalPackageJson)) {
    console.error('❌ web-portal package.json not found');
    process.exit(1);
  }
  
  const packageData = JSON.parse(fs.readFileSync(webPortalPackageJson, 'utf8'));
  const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
  
  const missing = requiredDependencies.filter(dep => !dependencies[dep]);
  
  if (missing.length > 0) {
    console.error('❌ Missing dependencies:', missing);
    process.exit(1);
  }
  
  console.log('✅ All required dependencies are present');
}

verifyDependencies();