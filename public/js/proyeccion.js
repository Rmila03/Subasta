const socket = io();

// Obtener PIN desde la URL
const urlParams = new URLSearchParams(window.location.search);
const pin = urlParams.get('pin');

const pinDisplay = document.getElementById('pinDisplay');
const productoNombre = document.getElementById('productoNombre');
const ofertaActual = document.getElementById('ofertaActual');
const liderActual = document.getElementById('liderActual');

if (!pin) {
  productoNombre.textContent = "PIN no válido";
} else {
  pinDisplay.textContent = pin;
  socket.emit('verificar_sala', { pin });
}

socket.on('sala_verificada', (data) => {
  if (!data.existe) {
    productoNombre.textContent = "Sala no encontrada";
  } else {
    socket.emit('unirse_sala', { pin, nombre: 'proyeccion_view' });
  }
});

socket.on('estado_inicial', (estado) => {
  actualizarVista(estado.productos);
});

socket.on('estado_subasta_cambiado', (datos) => {
  productoNombre.textContent = datos.estado === 'finalizado'
    ? `${datos.producto} (Finalizado)`
    : datos.producto;

  ofertaActual.textContent = `$${datos.oferta}`;
  liderActual.textContent = datos.lider || '-';
});

socket.on('actualizar_oferta', (datos) => {
  productoNombre.textContent = datos.producto;
  ofertaActual.textContent = `$${datos.oferta}`;
  liderActual.textContent = datos.lider || '-';
});

function actualizarVista(productos) {
  const productoActivo = productos.find(p => p.estado === 'activo');
  if (productoActivo) {
    productoNombre.textContent = productoActivo.nombre;
    ofertaActual.textContent = `$${productoActivo.ofertaActual}`;
    liderActual.textContent = productoActivo.lider || '-';
  } else {
    productoNombre.textContent = 'Esperando inicio de subasta';
    ofertaActual.textContent = '$0';
    liderActual.textContent = '-';
  }
}
