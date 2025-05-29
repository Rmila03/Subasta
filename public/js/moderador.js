const socket = io();
const createRoomForm = document.getElementById('createRoomForm');
const addProductForm = document.getElementById('addProductForm');
const roomPin = document.getElementById('roomPin');
const pinCard = document.getElementById('pinCard');
const proyectarBtn = document.getElementById('proyectarBtn');
const productosLista = document.getElementById('productosLista');
const listaProductos = document.getElementById('listaProductos');
const mensajeError = document.getElementById('mensajeError');
const productImageInput = document.getElementById('productImage'); // Referencia al input de imagen

let currentPin = null;

function mostrarError(msg) {
  mensajeError.textContent = msg;
  mensajeError.style.display = 'block';
  setTimeout(() => {
    mensajeError.style.display = 'none';
  }, 3000);
}

// --- NUEVA FUNCIÓN PARA REDIMENSIONAR IMAGEN ---
function resizeImage(file, maxWidth, maxHeight, quality, callback) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round(width * maxHeight / height);
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', quality)); // Convierte a Data URL (Base64)
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}
// --- FIN FUNCIÓN REDIMENSIONAR ---

function mostrarProducto(producto) {
  const item = document.createElement('div');
  item.className = 'producto-item';
  // Modificado para incluir la imagen si existe
  item.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
      <div>
        ${producto.imagenUrl ? `<img src="${producto.imagenUrl}" alt="${producto.nombre}" class="producto-imagen-miniatura mb-2">` : ''}
        <h5 class="mb-1">${producto.nombre}</h5>
        <div class="mb-2">
          <span class="badge ${producto.estado === 'activo' ? 'bg-success' : producto.estado === 'finalizado' ? 'bg-danger' : 'bg-secondary'}">
            ${producto.estado === 'activo' ? 'En subasta' : producto.estado === 'finalizado' ? 'Finalizado' : 'Pendiente'}
          </span>
        </div>
        <div class="text-muted">
          <small>Precio inicial: $${producto.precioInicial}</small>
          ${producto.estado !== 'pendiente' ? `
            <br>
            <small>Oferta actual: $${producto.ofertaActual}</small>
            ${producto.lider ? `<br><small>Líder: ${producto.lider}</small>` : ''}
          ` : ''}
        </div>
      </div>
      <div>
        ${producto.estado === 'pendiente' || producto.estado === 'finalizado' ? // Se puede iniciar si está pendiente o finalizado
          `<button class="btn btn-sm btn-success iniciar-subasta" data-producto-id="${producto.id}">
            <i class="fas fa-play"></i> Iniciar
          </button>` : 
          `<button class="btn btn-sm btn-danger finalizar-subasta" data-producto-id="${producto.id}">
            <i class="fas fa-stop"></i> Finalizar
          </button>`
        }
      </div>
    </div>
    ${producto.historialOfertas && producto.historialOfertas.length > 0 ? `
      <div class="historial-ofertas mt-3">
        <h6 class="text-muted mb-2">Historial de ofertas:</h6>
        <div class="list-group list-group-flush">
          ${producto.historialOfertas.map(oferta => `
            <div class="oferta-item">
              <div class="d-flex justify-content-between align-items-center">
                <span>${oferta.participante}</span>
                <span class="badge bg-primary">$${oferta.monto}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
  listaProductos.appendChild(item);
}

listaProductos.addEventListener('click', (e) => {
  const target = e.target.closest('button');
  if (!target) return;

  if (target.classList.contains('iniciar-subasta')) {
    const productoId = target.dataset.productoId;
    if (currentPin) {
      socket.emit('iniciar_subasta', { pin: currentPin, productoId });
    }
  } else if (target.classList.contains('finalizar-subasta')) {
    const productoId = target.dataset.productoId;
    if (currentPin) {
      socket.emit('finalizar_subasta', { pin: currentPin, productoId });
    }
  }
});

createRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('roomName').value;
  if (!name) {
    mostrarError("Por favor ingresa un nombre para la sala");
    return;
  }
  socket.emit('crear_sala', name);
});

addProductForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentPin) {
    mostrarError("Primero debes crear una sala.");
    return;
  }
  const nombre = document.getElementById('productName').value;
  const precioInicial = parseFloat(document.getElementById('startingPrice').value);
  const imagenFile = productImageInput.files[0]; // Obtener el archivo de imagen

  if (!nombre || isNaN(precioInicial) || precioInicial <= 0) {
    mostrarError("Por favor ingresa un nombre y precio válidos");
    return;
  }

  const productoBase = {
    nombre,
    precioInicial
  };

  if (imagenFile) {
    // Redimensionar imagen antes de enviarla (ej. max 400x400, calidad 0.7)
    resizeImage(imagenFile, 400, 400, 0.7, (resizedImageUrl) => {
      const productoConImagen = { ...productoBase, imagenUrl: resizedImageUrl };
      console.log('Agregando producto con imagen:', productoConImagen);
      socket.emit('agregar_producto', { pin: currentPin, producto: productoConImagen });
      addProductForm.reset(); // Limpia también el input de archivo
    });
  } else {
    // Agregar producto sin imagen
    console.log('Agregando producto sin imagen:', productoBase);
    socket.emit('agregar_producto', { pin: currentPin, producto: productoBase });
    addProductForm.reset();
  }
});

socket.on('sala_creada', (datos) => {
  console.log('Sala creada:', datos);
  currentPin = datos.pin;
  roomPin.textContent = datos.pin;
  pinCard.style.display = 'block';
  if (proyectarBtn) {
    proyectarBtn.style.display = 'inline-block';
  }
  productosLista.style.display = 'block';
  
  listaProductos.innerHTML = '';
  if (datos.productos) {
    datos.productos.forEach(producto => mostrarProducto(producto));
  }
});

socket.on('producto_agregado', (producto) => {
  console.log('Producto agregado:', producto);
  // Si la lista ya tiene muchos elementos, podría ser mejor solo añadir el nuevo
  // en lugar de recargar todo, pero para simplicidad, recuperamos todo si el servidor lo maneja bien
  // O, simplemente añadirlo a la lista existente:
  mostrarProducto(producto);
  // Si prefieres recargar todo para mantener consistencia con otros eventos:
  // if (currentPin) {
  //   socket.emit('recuperar_sala'); 
  // }
});

socket.on('estado_subasta_cambiado', (datos) => {
  console.log('Estado de subasta cambiado:', datos);
  if (currentPin) {
    socket.emit('recuperar_sala'); // Recargar todo para actualizar estados e imágenes
  }
});

socket.on('error', (mensaje) => {
  console.error('Error recibido:', mensaje);
  mostrarError(mensaje);
});

socket.on('actualizar_oferta', (datos) => {
  console.log('Oferta actualizada (moderador):', datos);
  if (currentPin) {
    socket.emit('recuperar_sala'); // Recargar todo para actualizar ofertas e imágenes
  }
});

if (proyectarBtn) {
  proyectarBtn.addEventListener('click', () => {
    if (currentPin) {
      const proyeccionUrl = `${window.location.origin}/proyeccion?pin=${currentPin}`;
      window.open(proyeccionUrl, '_blank');
    } else {
      mostrarError("No hay un PIN de sala activo para proyectar.");
    }
  });
}

socket.on('connect', () => {
  console.log('Conectado al servidor');
  socket.emit('recuperar_sala'); 
});

socket.on('disconnect', () => {
  console.log('Desconectado del servidor');
  mostrarError("Se ha perdido la conexión con el servidor");
});

socket.emit('recuperar_sala');