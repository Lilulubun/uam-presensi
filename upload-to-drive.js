#!/usr/bin/env node
/**
 * Upload kuesioner HTML ke Google Drive folder UAM.
 * 
 * Usage:
 *   node upload-to-drive.js
 * 
 * First run: akan membuka browser untuk login Google.
 * Token disimpan di ~/.uam-drive-token.json untuk reuse.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;

// Config - ganti dengan credentials dari Google Cloud Console jika ada
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const TOKEN_PATH = path.join(process.env.HOME || '/root', '.uam-drive-token.json');
const FOLDER_ID = '1menFOH1oO3tlQiEivPxbb8-JmTM7oQXI';
const FILE_PATH = path.join(__dirname, 'kuesioner-laporan-presensi-uam.html');

function getOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diset.');
    console.error('');
    console.error('📋 Cara mendapatkan credentials:');
    console.error('   1. Buka https://console.cloud.google.com/apis/credentials');
    console.error('   2. Buat OAuth 2.0 Client ID (Desktop application)');
    console.error('   3. Export env vars:');
    console.error('      export GOOGLE_CLIENT_ID="...".apps.googleusercontent.com');
    console.error('      export GOOGLE_CLIENT_SECRET="GOCSPX-..."');
    console.error('');
    console.error('📋 Alternatif: Upload manual via browser:');
    console.error('   1. Buka https://drive.google.com/drive/folders/' + FOLDER_ID);
    console.error('   2. Drag & drop file: ' + FILE_PATH);
    process.exit(1);
  }
  return new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function authenticate(oauth2Client) {
  // Check cached token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });

  console.log('🔐 Buka URL ini di browser untuk login Google:');
  console.log('');
  console.log('   ' + authUrl);
  console.log('');

  // Start local server to receive callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');
      if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>✅ Login berhasil!</h1><p>Anda dapat menutup halaman ini.</p>');
          resolve(code);
        } else {
          res.writeHead(400);
          res.end('Error: no code');
          reject(new Error('No authorization code received'));
        }
        server.close();
      }
    });
    server.listen(3000);
  });

  // Exchange code for token
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('✅ Token disimpan di ' + TOKEN_PATH);
  return oauth2Client;
}

async function uploadFile(auth) {
  const drive = google.drive({ version: 'v3', auth });

  const fileName = path.basename(FILE_PATH);
  const fileContent = fs.readFileSync(FILE_PATH);

  // Check if file already exists in folder
  const existing = await drive.files.list({
    q: `name='${fileName}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  const media = {
    mimeType: 'text/html',
    body: fileContent,
  };

  if (existing.data.files.length > 0) {
    // Update existing
    const fileId = existing.data.files[0].id;
    await drive.files.update({
      fileId,
      media: media,
    });
    console.log(`🔄 File diperbarui: ${fileName}`);
    console.log(`🔗 https://drive.google.com/file/d/${fileId}/view`);
  } else {
    // Upload new
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [FOLDER_ID],
      },
      media: media,
      fields: 'id',
    });
    console.log(`✅ File terupload: ${fileName}`);
    console.log(`🔗 https://drive.google.com/file/d/${res.data.id}/view`);
  }
}

async function main() {
  console.log('📤 Upload Kuesioner Laporan Presensi UAM ke Google Drive...\n');

  const oauth2Client = getOAuth2Client();
  const auth = await authenticate(oauth2Client);
  await uploadFile(auth);

  console.log('\n📂 Folder: https://drive.google.com/drive/folders/' + FOLDER_ID);
  console.log('✅ Selesai!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
