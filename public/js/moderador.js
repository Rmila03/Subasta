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
  item.className = 'list-group-item';
  item.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <h6 class="mb-1">${producto.nombre}</h6>
        <small class="text-muted">Precio inicial: $${producto.precioInicial}</small>
        ${producto.estado === 'activo' ? '<span class="badge bg-success ms-2">En subasta</span>' : ''}
      </div>
      <div>
        ${producto.estado !== 'activo' ? 
          `<button class="btn btn-sm btn-success" onclick="iniciarSubasta('${producto.id}')">
            <i class="fas fa-play"></i> Iniciar
          </button>` : 
          `<button class="btn btn-sm btn-danger" onclick="finalizarSubasta('${producto.id}')">
            <i class="fas fa-stop"></i> Finalizar
          </button>`
        }
      </div>
    </div>
  `;
  listaProductos.appendChild(item);
}

// Función para iniciar la subasta de un producto
window.iniciarSubasta = function(productoId) {
  if (currentPin) {
    console.log('Iniciando subasta:', { pin: currentPin, productoId });
    socket.emit('iniciar_subasta', { pin: currentPin, productoId });
  }
};

// Función para finalizar la subasta de un producto
window.finalizarSubasta = function(productoId) {
  if (currentPin) {
    console.log('Finalizando subasta:', { pin: currentPin, productoId });
    socket.emit('finalizar_subasta', { pin: currentPin, productoId });
  }
};

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