function previewFoto(){
  var url=document.getElementById('inv-foto').value.trim();
  var preview=document.getElementById('inv-foto-preview');
  if(!preview)return;
  if(url){var img=document.createElement('img');img.src=url;img.style.cssText='width:100%;height:100%;object-fit:cover;';img.onerror=()=>{preview.textContent='?';};preview.innerHTML='';preview.appendChild(img);}
  else{preview.textContent='Sin foto';}
}

/* ============================================================
   SUBIDA DE FOTOS LOCAL (SIN IA, SIN URL, SIN INTERNET)
   ============================================================
   Funciona desde cualquier dispositivo (PC, tablet, celular) y
   con cualquier formato de imagen comun (JPG, PNG, WEBP, etc).
   La imagen se lee directo del dispositivo, se comprime un poco
   para no llenar el almacenamiento local, y se guarda como texto
   (base64) dentro del mismo campo #inv-foto que ya usaba el resto
   del codigo (el picker, el listado, el detalle, etc siguen
   funcionando igual).
   ============================================================ */

async function subirFotoLocal(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const status = document.getElementById('inv-foto-status');
  if (status) { status.style.color = 'var(--muted)'; status.textContent = 'Procesando imagen...'; }

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });

    document.getElementById('inv-foto').value = dataUrl;
    if (typeof previewFoto === 'function') previewFoto();

    if (status) { status.style.color = 'var(--green)'; status.textContent = 'Imagen lista.'; }
  } catch (err) {
    if (status) { status.style.color = 'var(--red)'; status.textContent = 'No se pudo procesar la imagen. Intenta con otra.'; }
  }
}

export { previewFoto, subirFotoLocal };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { subirFotoLocal });
