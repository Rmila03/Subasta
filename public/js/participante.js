const socket = io();
const pinSection = document.getElementById('pinSection');
const nameSection = document.getElementById('nameSection');
const auctionSection = document.getElementById('auctionSection');
const pinForm = document.getElementById('pinForm');
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

pinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('roomPin').value;
    
    if (!pin) {
        mostrarError("Por favor ingresa el PIN de la sala");
        return;
    }

    // Verificar si la sala existe
    socket.emit('verificar_sala', { pin });
});

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
        pinSection.style.display = 'none';
        nameSection.style.display = 'block';
    } else {
        mostrarError("El PIN ingresado no corresponde a ninguna sala activa");
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
});

socket.on('estado_inicial', (estado) => {
    console.log('Estado inicial recibido:', estado);
    
    if (estado.productos && estado.productos.length > 0) {
        const productoActivo = estado.productos.find(p => p.estado === 'activo');
        if (productoActivo) {
            productoNombre.textContent = productoActivo.nombre;
            ofertaActual.textContent = `$${productoActivo.ofertaActual}`;
            liderActual.textContent = productoActivo.lider || 'Sin ofertas';
            nameSection.style.display = 'none';
            auctionSection.style.display = 'block';
            
            // Limpiar y mostrar historial de ofertas
            historialOfertas.innerHTML = '';
            if (productoActivo.historialOfertas) {
                productoActivo.historialOfertas.forEach(oferta => agregarOfertaAlHistorial(oferta));
            }
        }
    }
});

socket.on('actualizar_oferta', (datos) => {
    console.log('Oferta actualizada:', datos);
    productoNombre.textContent = datos.producto;
    ofertaActual.textContent = `$${datos.oferta}`;
    liderActual.textContent = datos.lider || 'Sin ofertas';
    if (datos.oferta) {
        agregarOfertaAlHistorial({
            participante: datos.lider,
            monto: datos.oferta
        });
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