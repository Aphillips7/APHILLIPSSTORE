import { db, firebase } from '../../firebase.js';

let _totpSecretCache = null;
let _backupCodesCache = null;
function limpiarCacheAuth(){ _totpSecretCache = null; _backupCodesCache = null; }

// =================== AUTENTICACION (TOTP) ===================
// Codigo de 6 digitos que protege la pestana Sync. Se verifica en el navegador,
// asi que es una capa extra de interfaz, no de seguridad: los datos los protege
// el login de Firebase + firestore.rules (authSettings solo lo lee el admin).
const B32_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes){
  var bits='',output='';
  for(var i=0;i<bytes.length;i++){ bits+=bytes[i].toString(2).padStart(8,'0'); }
  for(i=0;i+5<=bits.length;i+=5){ output+=B32_CHARS[parseInt(bits.substr(i,5),2)]; }
  if(bits.length%5!==0){
    var rem=bits.length%5;
    var last=bits.substr(bits.length-rem).padEnd(5,'0');
    output+=B32_CHARS[parseInt(last,2)];
  }
  return output;
}
function base32Decode(str){
  str=str.replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  var bits='';
  for(var i=0;i<str.length;i++){
    var val=B32_CHARS.indexOf(str[i]);
    if(val===-1)continue;
    bits+=val.toString(2).padStart(5,'0');
  }
  var bytes=[];
  for(i=0;i+8<=bits.length;i+=8){ bytes.push(parseInt(bits.substr(i,8),2)); }
  return new Uint8Array(bytes);
}
function generarSecretoTotp(){
  var bytes=new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}
async function totpCodigoParaPaso(secretBase32,step){
  var keyBytes=base32Decode(secretBase32);
  var key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-1'},false,['sign']);
  var counter=new ArrayBuffer(8);
  var view=new DataView(counter);
  view.setUint32(4,step>>>0,false);
  view.setUint32(0,Math.floor(step/4294967296),false);
  var sigBuf=await crypto.subtle.sign('HMAC',key,counter);
  var sig=new Uint8Array(sigBuf);
  var offset=sig[sig.length-1]&0xf;
  var bin=((sig[offset]&0x7f)<<24)|((sig[offset+1]&0xff)<<16)|((sig[offset+2]&0xff)<<8)|(sig[offset+3]&0xff);
  return (bin%1000000).toString().padStart(6,'0');
}
async function totpVerificar(secretBase32,codigoIngresado){
  if(!secretBase32||!/^\d{6}$/.test(codigoIngresado))return false;
  var pasoActual=Math.floor(Date.now()/1000/30);
  for(var delta=-2;delta<=2;delta++){
    var c=await totpCodigoParaPaso(secretBase32,pasoActual+delta);
    if(c===codigoIngresado)return true;
  }
  return false;
}
function getTotpSecret(){ return _totpSecretCache||''; }
async function cargarAuthSettingsNube(){
  var u=firebase.auth().currentUser;
  if(!u){ _totpSecretCache=''; _backupCodesCache=[]; return; }
  try{
    var doc=await db.collection('authSettings').doc(u.uid).get();
    if(doc.exists){
      var data=doc.data();
      _totpSecretCache=data.secret||'';
      _backupCodesCache=data.backupCodes||[];
    }else{
      _totpSecretCache='';
      _backupCodesCache=[];
    }
  }catch(e){
    _totpSecretCache='';
    _backupCodesCache=[];
  }
}
async function guardarAuthSettingsNube(secret,backupCodes){
  var u=firebase.auth().currentUser;
  if(!u)return;
  await db.collection('authSettings').doc(u.uid).set({secret:secret,backupCodes:backupCodes,actualizado:Date.now()});
  _totpSecretCache=secret;
  _backupCodesCache=backupCodes;
}

// --- Codigos de respaldo ---
function generarCodigoRespaldo(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var rnd=new Uint8Array(8);
  crypto.getRandomValues(rnd);
  var s='';
  for(var i=0;i<8;i++){ s+=chars[rnd[i]%chars.length]; if(i===3)s+='-'; }
  return s;
}
async function sha256Hex(texto){
  var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}
async function generarLoteCodigosRespaldo(n){
  n=n||8;
  var codigos=[],hashes=[];
  for(var i=0;i<n;i++){
    var c=generarCodigoRespaldo();
    codigos.push(c);
    hashes.push({hash:await sha256Hex(c),usado:false});
  }
  return {codigos:codigos,hashes:hashes};
}
async function verificarCodigoRespaldo(codigoIngresado){
  var lista=_backupCodesCache||[];
  var hashIngresado=await sha256Hex(codigoIngresado.trim().toUpperCase());
  for(var i=0;i<lista.length;i++){
    if(lista[i].hash===hashIngresado && !lista[i].usado){
      lista[i].usado=true;
      await guardarAuthSettingsNube(getTotpSecret(),lista);
      return {ok:true,restantes:lista.filter(function(x){return !x.usado;}).length};
    }
  }
  return {ok:false};
}
function contarBackupInfo(){
  var lista=_backupCodesCache||[];
  return {restantes:lista.filter(function(x){return !x.usado;}).length,total:lista.length};
}

export { _backupCodesCache, _totpSecretCache, B32_CHARS, base32Decode, base32Encode, cargarAuthSettingsNube, contarBackupInfo, generarCodigoRespaldo, generarLoteCodigosRespaldo, generarSecretoTotp, getTotpSecret, guardarAuthSettingsNube, limpiarCacheAuth, sha256Hex, totpCodigoParaPaso, totpVerificar, verificarCodigoRespaldo };
