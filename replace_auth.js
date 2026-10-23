const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/api/db/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex1 = /} catch \(error\) {\s+let errorMessage = error instanceof Error \? error\.message : 'Failed';\s+if \(errorMessage\.includes\('SSL alert number 80'\) \|\| errorMessage\.includes\('ssl3_read_bytes'\)\) {\s+errorMessage = 'Connection refused by MongoDB Atlas\. Please ensure you have whitelisted all IPs \(0\.0\.0\.0\/0\) in your MongoDB Atlas Network Access settings\.';\s+}/g;

const replacer1 = `} catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : 'Failed';
    if (errorMessage.includes('SSL alert number 80') || errorMessage.includes('ssl3_read_bytes')) {
      errorMessage = 'Connection refused by MongoDB Atlas. Please ensure you have whitelisted all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.';
    } else if (errorMessage.toLowerCase().includes('bad auth') || errorMessage.toLowerCase().includes('authentication failed')) {
      errorMessage = 'Failed to authenticate with MongoDB. Please check your database credentials in the connection string.';
    }`;

const regex2 = /} catch \(error: any\) {\s+let errorMessage = error instanceof Error \? error\.message : 'Failed';\s+if \(errorMessage\.includes\('SSL alert number 80'\) \|\| errorMessage\.includes\('ssl3_read_bytes'\)\) {\s+errorMessage = 'Connection refused by MongoDB Atlas\. Please ensure you have whitelisted all IPs \(0\.0\.0\.0\/0\) in your MongoDB Atlas Network Access settings\.';\s+}/g;

const replacer2 = `} catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : 'Failed';
    if (errorMessage.includes('SSL alert number 80') || errorMessage.includes('ssl3_read_bytes')) {
      errorMessage = 'Connection refused by MongoDB Atlas. Please ensure you have whitelisted all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.';
    } else if (errorMessage.toLowerCase().includes('bad auth') || errorMessage.toLowerCase().includes('authentication failed')) {
      errorMessage = 'Failed to authenticate with MongoDB. Please check your database credentials in the connection string.';
    }`;

content = content.replace(regex1, replacer1).replace(regex2, replacer2);

fs.writeFileSync(filePath, content);
console.log('Replaced successfully');
