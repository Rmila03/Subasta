const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const pin = urlParams.get('pin'); // Este es el PIN de la sala que se está proyectando

// --- Elementos del DOM ---
const pinDisplay = document.getElementById('pinDisplay');
const productoNombre = document.getElementById('productoNombre');
const ofertaActual = document.getElementById('ofertaActual');
const liderActual = document.getElementById('liderActual');
const productoImagenDisplay = document.getElementById('productoImagenDisplay');
const labelOferta = document.getElementById('labelOferta');
const labelLider = document.getElementById('labelLider');
const felicitacionMensaje = document.getElementById('felicitacionMensaje');

// --- Elementos para QR y Enlace ---
const qrCodeSection = document.getElementById('qrCodeSection');
const qrcodeCanvas = document.getElementById('qrcodeCanvas'); // Referencia al canvas
const salaLink = document.getElementById('salaLink');
let qrCodeInstance = null; // Para mantener la instancia del QR
const qrcodeElementContainer = document.getElementById('qrcodeElementContainer'); // Referencia al DIV



function generarYMostrarQR(pinSala) {
    if (!pinSala) {
        qrCodeSection.style.display = 'none';
        return;
    }

    const urlParticipante = `${window.location.origin}/participante.html?pin=${pinSala}`;
    salaLink.href = urlParticipante;
    salaLink.textContent = urlParticipante;

    // Limpiar el contenedor del QR anterior antes de generar uno nuevo
    qrcodeElementContainer.innerHTML = ''; // ¡IMPORTANTE!

    const qrSize = Math.min(qrcodeElementContainer.parentElement.clientWidth * 0.7, 150); // Ajusta el tamaño

    // No necesitas qrCodeInstance si limpias y recreas cada vez
    // if (qrCodeInstance) {
    //     qrCodeInstance.clear(); 
    //     qrCodeInstance.makeCode(urlParticipante);
    // } else {
    new QRCode(qrcodeElementContainer, { // Usar el DIV contenedor
        text: urlParticipante,
        width: qrSize,
        height: qrSize,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    // }
    
    qrCodeSection.style.display = 'flex';
    console.log(`QR generado para: ${urlParticipante} en #qrcodeElementContainer`);
}

function resetearEstilosVista() {
    productoNombre.classList.remove('finalizado-nombre');
    const finalizadoTextElement = document.querySelector('.finalizado-text');
    if (finalizadoTextElement) {
        finalizadoTextElement.remove();
    }
    labelOferta.textContent = '💵 Oferta actual:';
    labelOferta.classList.remove('final');
    labelLider.textContent = '👑 Líder:';
    labelLider.classList.remove('final');
    liderActual.classList.remove('ganador');
    liderActual.style.fontSize = ''; 
    liderActual.style.color = '';
    liderActual.style.backgroundColor = '';
    liderActual.style.border = '';
    liderActual.style.padding = '';
    liderActual.style.textTransform = '';
    if (felicitacionMensaje) felicitacionMensaje.style.display = 'none';
}

function mostrarImagen(imagenUrl) {
    if (imagenUrl && imagenUrl.startsWith('data:image')) {
        productoImagenDisplay.src = imagenUrl;
        productoImagenDisplay.style.display = 'block';
        productoImagenDisplay.onload = () => console.log('Imagen cargada.');
        productoImagenDisplay.onerror = () => {
            console.error('Error al cargar imagen desde Data URL.');
            productoImagenDisplay.style.display = 'none';
        };
    } else {
        productoImagenDisplay.src = '';
        productoImagenDisplay.style.display = 'none';
    }
}


if (!pin) {
  productoNombre.textContent = "PIN no válido";
  mostrarImagen(null);
  qrCodeSection.style.display = 'none'; // Ocultar sección QR
} else {
  pinDisplay.textContent = pin; // Mostrar el PIN de la URL inmediatamente
  generarYMostrarQR(pin); // Generar QR con el PIN de la URL
  socket.emit('verificar_sala', { pin });
  mostrarImagen(null);
}

socket.on('sala_verificada', (data) => {
  if (!data.existe) {
    productoNombre.textContent = "Sala no encontrada";
    mostrarImagen(null);
    qrCodeSection.style.display = 'none'; // Ocultar si la sala no existe
  } else {
    // El PIN ya fue verificado y es el correcto, el QR ya debería estar generado.
    // Actualizar el PIN en pantalla si el servidor lo devuelve normalizado (aunque debería ser el mismo)
    pinDisplay.textContent = data.pin; 
    generarYMostrarQR(data.pin); // Re-generar o asegurar que está visible con el PIN confirmado
    socket.emit('unirse_sala', { pin: data.pin, nombre: 'proyeccion_view' });
  }
});

socket.on('estado_inicial', (estado) => {
  console.log('Estado inicial recibido:', estado);
  // El PIN de la sala debería estar en estado.pinDeSala o similar si el servidor lo provee
  // Si no, seguimos usando el 'pin' de la URL.
  // Si el estado inicial incluye el PIN de la sala (ej. estado.pinSala), úsalo:
  // if(estado.pinSala) generarYMostrarQR(estado.pinSala);
  actualizarVista(estado.productos);
});

socket.on('estado_subasta_cambiado', (datos) => {
  console.log('Estado de subasta cambiado:', datos);
  resetearEstilosVista();
  mostrarImagen(datos.imagenUrl);

  // Asegurarse que el QR siga visible (el PIN no cambia durante la subasta)
  if (pin) generarYMostrarQR(pin);


  if (datos.estado === 'finalizado') {
    productoNombre.textContent = datos.producto;
    let finalizadoSpan = productoNombre.nextElementSibling;
    if (!finalizadoSpan || !finalizadoSpan.classList.contains('finalizado-text')) {
        finalizadoSpan = document.createElement('span');
        finalizadoSpan.className = 'finalizado-text';
        productoNombre.parentNode.insertBefore(finalizadoSpan, productoNombre.nextSibling);
    }
    finalizadoSpan.textContent = '(Subasta Finalizada)';

    ofertaActual.textContent = `$${datos.oferta}`;
    labelOferta.textContent = '💵 Oferta Final:';
    labelOferta.classList.add('final');
    labelLider.textContent = '🏆 ¡GANADOR!:';
    labelLider.classList.add('final');

    if (datos.lider) {
      liderActual.textContent = `👑 ${datos.lider} 👑`;
      liderActual.classList.add('ganador');
      if (felicitacionMensaje) {
        felicitacionMensaje.innerHTML = `¡ENHORABUENA <strong style="text-transform: uppercase;">${datos.lider}</strong>!<br>Ganaste la subasta de <strong>${datos.producto}</strong>.`;
        felicitacionMensaje.style.display = 'block';
      }
    } else {
      liderActual.textContent = 'Sin ganador';
      if (felicitacionMensaje) felicitacionMensaje.style.display = 'none';
    }
  } else { 
    productoNombre.textContent = datos.producto;
    ofertaActual.textContent = `$${datos.oferta}`;
    liderActual.textContent = datos.lider || '-';
  }
});

socket.on('actualizar_oferta', (datos) => {
  console.log('Actualizar oferta:', datos);
  const esFinalizadoUI = document.querySelector('.finalizado-text') !== null;
  if (esFinalizadoUI && datos.producto === productoNombre.textContent) return;

  resetearEstilosVista();
  mostrarImagen(datos.imagenUrl); 
  
  productoNombre.textContent = datos.producto;
  ofertaActual.textContent = `$${datos.oferta}`;
  liderActual.textContent = datos.lider || '-';
});

function actualizarVista(productos) {
  resetearEstilosVista();
  const productoActivo = productos.find(p => p.estado === 'activo');

  if (productoActivo) {
    mostrarImagen(productoActivo.imagenUrl);
    productoNombre.textContent = productoActivo.nombre;
    ofertaActual.textContent = `$${productoActivo.ofertaActual}`;
    liderActual.textContent = productoActivo.lider || '-';
  } else {
    const finalizados = productos.filter(p => p.estado === 'finalizado');
    if (finalizados.length > 0) {
        const ultimoFinalizado = finalizados[finalizados.length - 1];
        // Usamos el evento 'estado_subasta_cambiado' para la UI de finalizado
        // Esto llamará indirectamente a generarYMostrarQR si el PIN es válido.
        socket.emit('estado_subasta_cambiado', { 
            producto: ultimoFinalizado.nombre,
            oferta: ultimoFinalizado.ofertaActual,
            lider: ultimoFinalizado.lider,
            estado: 'finalizado',
            imagenUrl: ultimoFinalizado.imagenUrl
        });
    } else {
        productoNombre.textContent = 'Esperando inicio de subasta';
        ofertaActual.textContent = '$0';
        liderActual.textContent = '-';
        mostrarImagen(null);
    }
  }
  // Asegurar que el QR se muestre si el PIN es válido, independientemente del estado del producto
  if(pin) generarYMostrarQR(pin);
}