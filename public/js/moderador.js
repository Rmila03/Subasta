const socket = io();
const createRoomForm = document.getElementById('createRoomForm');
const addProductForm = document.getElementById('addProductForm');
const roomPin = document.getElementById('roomPin');
const pinCard = document.getElementById('pinCard');
const productosLista = document.getElementById('productosLista');
const listaProductos = document.getElementById('listaProductos');
const mensajeError = document.getElementById('mensajeError');
let currentPin = null;

function mostrarError(msg) {
  mensajeError.textContent = msg;
  mensajeError.style.display = 'block';
  setTimeout(() => {
    mensajeError.style.display = 'none';
  }, 3000);
}

// Función para mostrar un producto en la lista
function mostrarProducto(producto) {
  const item = document.createElement('div');
  item.className = 'producto-item';
  item.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
      <div>
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
        ${producto.estado !== 'activo' ? 
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

// Event delegation para los botones de iniciar y finalizar
listaProductos.addEventListener('click', (e) => {
  const target = e.target.closest('button');
  if (!target) return;

  if (target.classList.contains('iniciar-subasta')) {
    const productoId = target.dataset.productoId;
    if (currentPin) {
      console.log('Iniciando subasta:', { pin: currentPin, productoId });
      socket.emit('iniciar_subasta', { pin: currentPin, productoId });
    }
  } else if (target.classList.contains('finalizar-subasta')) {
    const productoId = target.dataset.productoId;
    if (currentPin) {
      console.log('Finalizando subasta:', { pin: currentPin, productoId });
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
  console.log('Creando sala:', name);
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
  
  if (!nombre || isNaN(precioInicial) || precioInicial <= 0) {
    mostrarError("Por favor ingresa un nombre y precio válidos");
    return;
  }

  const producto = {
    nombre,
    precioInicial
  };
  console.log('Agregando producto:', producto);
  socket.emit('agregar_producto', { pin: currentPin, producto });
  addProductForm.reset();
});

socket.on('sala_creada', (datos) => {
  console.log('Sala creada:', datos);
  currentPin = datos.pin;
  roomPin.textContent = datos.pin;
  pinCard.style.display = 'block';
  productosLista.style.display = 'block';
  
  // Limpiar lista de productos
  listaProductos.innerHTML = '';
  
  // Mostrar productos existentes si los hay
  if (datos.productos) {
    datos.productos.forEach(producto => mostrarProducto(producto));
  }
});

socket.on('producto_agregado', (producto) => {
  console.log('Producto agregado:', producto);
  mostrarProducto(producto);
});

socket.on('estado_subasta_cambiado', (datos) => {
  console.log('Estado de subasta cambiado:', datos);
  // Actualizar la lista de productos
  listaProductos.innerHTML = '';
  if (currentPin) {
    socket.emit('recuperar_sala');
  }
});

socket.on('error', (mensaje) => {
  console.error('Error recibido:', mensaje);
  mostrarError(mensaje);
});

// Manejar reconexión
socket.on('connect', () => {
  console.log('Conectado al servidor');
});

socket.on('disconnect', () => {
  console.log('Desconectado del servidor');
  mostrarError("Se ha perdido la conexión con el servidor");
});

// Recuperar sala al cargar la página
socket.emit('recuperar_sala'); 