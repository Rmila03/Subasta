const socket = io();
const pinSection = document.getElementById('pinSection');
const nameSection = document.getElementById('nameSection');
const auctionSection = document.getElementById('auctionSection');
const nameForm = document.getElementById('nameForm');
const salaPin = document.getElementById('salaPin');
const productoNombre = document.getElementById('productoNombre');
const ofertaActual = document.getElementById('ofertaActual');
const liderActual = document.getElementById('liderActual');
const mensajeError = document.getElementById('mensajeError');
const bidForm = document.getElementById('bidForm');
const nuevaOferta = document.getElementById('nuevaOferta');
const historialOfertas = document.getElementById('historialOfertas');

// Obtener el PIN de la URL
const urlParams = new URLSearchParams(window.location.search);
const currentPin = urlParams.get('pin');

console.log('PIN obtenido de URL:', currentPin);

if (!currentPin) {
    mostrarError("No se encontró el PIN de la sala");
    setTimeout(() => {
        window.location.href = '/';
    }, 2000);
} else {
    salaPin.textContent = currentPin;
    // Verificar la sala inmediatamente al cargar
    socket.emit('verificar_sala', { pin: currentPin });
}

function mostrarError(msg) {
    console.error('Error:', msg);
    mensajeError.textContent = msg;
    mensajeError.style.display = 'block';
    setTimeout(() => {
        mensajeError.style.display = 'none';
    }, 3000);
}

// Función para agregar una oferta al historial
function agregarOfertaAlHistorial(oferta) {
    const item = document.createElement('div');
    item.className = 'list-group-item';
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <span>${oferta.participante}</span>
            <span class="badge bg-primary">$${oferta.monto}</span>
        </div>
    `;
    historialOfertas.insertBefore(item, historialOfertas.firstChild);
}

// Inicializar event listeners solo si los elementos existen
if (nameForm) {
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = document.getElementById('participantName').value;
        
        if (!nombre) {
            mostrarError("Por favor ingresa tu nombre");
            return;
        }

        if (!currentPin) {
            mostrarError("Error: No se encontró el PIN de la sala");
            return;
        }

        console.log('Intentando unirse a sala:', { pin: currentPin, nombre });
        socket.emit('unirse_sala', { pin: currentPin, nombre });
    });
}

if (bidForm) {
    bidForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const monto = parseFloat(nuevaOferta.value);
        if (!isNaN(monto) && monto > 0) {
            socket.emit('nueva_oferta', { monto });
            nuevaOferta.value = '';
        } else {
            mostrarError("Por favor ingresa un monto válido");
        }
    });
}

// Escuchar la respuesta de verificación de sala
socket.on('sala_verificada', (datos) => {
    console.log('Respuesta de verificación de sala:', datos);
    if (datos.existe) {
        if (pinSection) pinSection.style.display = 'none';
        if (nameSection) nameSection.style.display = 'block';
    } else {
        mostrarError("El PIN ingresado no corresponde a ninguna sala activa");
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
});

socket.on('estado_inicial', (estado) => {
    console.log('Estado inicial recibido:', estado);
    
    // Si ya hay un participante, mostrar la sección de subasta
    if (estado.participante) {
        if (nameSection) nameSection.style.display = 'none';
        if (auctionSection) auctionSection.style.display = 'block';
    }
    
    if (estado.productos && estado.productos.length > 0) {
        const productoActivo = estado.productos.find(p => p.estado === 'activo');
        if (productoActivo) {
            productoNombre.textContent = productoActivo.nombre;
            ofertaActual.textContent = `$${productoActivo.ofertaActual || productoActivo.precioInicial}`;
            liderActual.textContent = productoActivo.lider || 'Sin ofertas';
        } else {
            productoNombre.textContent = 'Esperando inicio de la subasta';
            ofertaActual.textContent = '$0';
            liderActual.textContent = '-';
        }
    }
});

socket.on('actualizar_oferta', (datos) => {
    console.log('Oferta actualizada:', datos);
    productoNombre.textContent = datos.producto;
    ofertaActual.textContent = `$${datos.oferta}`;
    liderActual.textContent = datos.lider || 'Sin ofertas';

    // Actualizar historial de ofertas
    historialOfertas.innerHTML = ''; // Limpiar historial actual
    datos.historial.forEach(oferta => agregarOfertaAlHistorial(oferta));
});

socket.on('producto_agregado', (producto) => {
    console.log('Nuevo producto recibido:', producto);

    // Si es el primer producto y está en estado 'pendiente'
    if (producto.estado === 'pendiente') {
        productoNombre.textContent = `${producto.nombre} (Esperando inicio de subasta)`;
        ofertaActual.textContent = `$${producto.precioInicial}`;
        liderActual.textContent = '-';
        historialOfertas.innerHTML = '';
    }

    // Si el producto llega activo (poco común, pero posible)
    if (producto.estado === 'activo') {
        productoNombre.textContent = producto.nombre;
        ofertaActual.textContent = `$${producto.ofertaActual}`;
        liderActual.textContent = producto.lider || 'Sin ofertas';
        historialOfertas.innerHTML = '';
        producto.historialOfertas.forEach(oferta => agregarOfertaAlHistorial(oferta));
    }
});


socket.on('error', (mensaje) => {
    console.error('Error recibido:', mensaje);
    mostrarError(mensaje);
});

socket.on('error_oferta', (mensaje) => {
    console.error('Error de oferta:', mensaje);
    mostrarError(mensaje);
});

// Manejar reconexión
socket.on('connect', () => {
    console.log('Conectado al servidor');
    // Si tenemos un PIN, verificar la sala nuevamente
    if (currentPin) {
        socket.emit('verificar_sala', { pin: currentPin });
    }
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
    mostrarError("Se ha perdido la conexión con el servidor");
}); 