#!/usr/bin/env node
/*
 * Free My TV+: signiert FreeMyTVPlus-tizen.wgt fuer Samsung-Fernseher von 2017 bis 2022 (Tizen 3 bis 6.5),
 * ohne Tizen Studio. Laeuft in GitHub Actions (.github/workflows/tizen-release.yml), geht aber auch lokal:
 *
 *   node tools/sign_tizen.js <certificates-Ordner> <author.p12> <passwort> FreeMyTVPlus-tizen.wgt
 *
 * <certificates-Ordner>: der Ordner data/tools/certificate-generator/certificates aus Samsungs/Tizens
 * certificate-generator (download.tizen.org), darin developer/ und distributor/.
 * Gibt es <author.p12> noch nicht, wird ein neues Autor-Zertifikat erzeugt (von der Tizen-Entwickler-CA signiert)
 * und dort gespeichert. Fuer Updates muss es dasselbe bleiben: sonst die App am TV erst loeschen.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const JSZip = require('jszip');
const { Signature } = require('tizen');

const [certDir, authorPath, authorPwd, wgtPath] = process.argv.slice(2);
if (!certDir || !authorPath || !authorPwd || !wgtPath) {
  console.error('Aufruf: node tools/sign_tizen.js <certificates-Ordner> <author.p12> <passwort> <app.wgt>');
  process.exit(2);
}

function loadP12(file, password) {
  const der = forge.util.createBuffer(fs.readFileSync(file).toString('binary'));
  return forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, password);
}

/** Neues Autor-Zertifikat: eigener Schluessel, signiert von der Tizen-Entwickler-CA (wie Tizen Studio es macht). */
function createAuthor() {
  const caKeyPem = fs.readFileSync(path.join(certDir, 'developer', 'tizen-developer-ca-privatekey.pem'), 'utf-8');
  const caKey = forge.pki.decryptRsaPrivateKey(caKeyPem, 'tizencertificatefordevelopercaroqkfwk');
  const caPem = fs.readFileSync(path.join(certDir, 'developer', 'tizen-developer-ca.cer'), 'utf-8');
  const ca = forge.pki.certificateFromPem(caPem);
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0' + forge.util.bytesToHex(forge.random.getBytesSync(8));
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 20 * 365 * 86400000);
  cert.setSubject([{ name: 'commonName', value: 'Free My TV Plus' }, { name: 'organizationName', value: 'Free My TV Plus' }]);
  cert.setIssuer(ca.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
    { name: 'extKeyUsage', codeSigning: true }
  ]);
  cert.sign(caKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert, ca], authorPwd,
    { generateLocalKeyId: true, friendlyName: 'UserCertificate', algorithm: '3des' });
  fs.writeFileSync(authorPath, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
  console.log('Neues Autor-Zertifikat erstellt: ' + authorPath);
}

(async () => {
  if (!fs.existsSync(authorPath)) createAuthor();
  const author = loadP12(authorPath, authorPwd);
  const distributor = loadP12(path.join(certDir, 'distributor', 'sdk-public', 'tizen-distributor-signer.p12'),
    'tizenpkcs12passfordsigner');

  const zip = await JSZip.loadAsync(fs.readFileSync(wgtPath));
  let files = [];
  for (const name of Object.keys(zip.files).sort()) {
    const entry = zip.files[name];
    if (entry.dir || /^(author-signature|signature\d+)\.xml$/.test(name)) continue;
    files.push({ uri: encodeURIComponent(name).replace(/%2F/g, '/'), data: await entry.async('nodebuffer') });
  }
  files = await new Signature('AuthorSignature', files).sign(author);
  files = await new Signature('DistributorSignature', files).sign(distributor);

  const out = new JSZip();
  for (const f of files) out.file(decodeURIComponent(f.uri), f.data);
  fs.writeFileSync(wgtPath, await out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const names = Object.keys((await JSZip.loadAsync(fs.readFileSync(wgtPath))).files);
  if (names.indexOf('author-signature.xml') < 0 || names.indexOf('signature1.xml') < 0) {
    console.error('Die Signaturen fehlen im Paket.');
    process.exit(1);
  }
  console.log('Signiert: ' + wgtPath + ' (' + names.length + ' Dateien)');
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
