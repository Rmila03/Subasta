// Archivo: server.js (versión extendida con creación de sala por moderador)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');

const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);


app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : '*'
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // límite de 100 peticiones por ventana
});
app.use(limiter);

// Configuración de Socket.IO con seguridad
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static('public'));

// Estructura de datos mejorada para las salas con expiración
let salas = new Map(); // PIN => { datos, expiración }

// Configuración de expiración de salas (24 horas)
const EXPIRACION_SALA = 24 * 60 * 60 * 1000;

// Función para limpiar salas expiradas
function limpiarSalasExpiradas() {
    const ahora = Date.now();
    for (const [pin, sala] of salas.entries()) {
        if (sala.expira && sala.expira < ahora) {
            salas.delete(pin);
        }
    }
}

// Ejecutar limpieza cada hora
setInterval(limpiarSalasExpiradas, 60 * 60 * 1000);

function generarPin() {
    return crypto.randomInt(100000, 999999).toString();
}

function generarIdProducto() {
    return crypto.randomBytes(8).toString('hex');
}

// Validación de entrada
function validarProducto(producto) {
    return (
        producto &&
        typeof producto.nombre === 'string' &&
        producto.nombre.length >= 3 &&
        producto.nombre.length <= 100 &&
        typeof producto.precioInicial === 'number' &&
        producto.precioInicial > 0
    );
}

// Rutas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/participante', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/participante.html'));
});

app.get('/moderador', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/moderador.html'));
});

// Verificar si una sala existe
app.post('/api/verificar-sala', (req, res) => {
  const { pin } = req.body;
  const sala = salas.get(pin);
  res.json({ existe: !!sala });
});

// Middleware de autenticación para Socket.IO
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (process.env.NODE_ENV === 'production' && !token) {
        return next(new Error('Authentication error'));
    }
    next();
});

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    // Verificar sala
    socket.on('verificar_sala', ({ pin }) => {
        console.log('Verificando sala:', pin);
        const sala = salas.get(pin);
        console.log('Resultado de verificación:', { 
            existe: !!sala,
            pin: sala ? pin : null,
            nombre: sala ? sala.nombre : null
        });
        socket.emit('sala_verificada', { 
            existe: !!sala,
            pin: sala ? pin : null
        });
    });

    // Crear una nueva sala
    socket.on('crear_sala', (nombre) => {
        try {
            if (!nombre || typeof nombre !== 'string' || nombre.length < 3) {
                throw new Error('Nombre de sala inválido');
            }

            const pin = generarPin();
            const sala = {
                nombre,
                productos: new Map(),
                participantes: new Map(),
                moderador: socket.id,
                expira: Date.now() + EXPIRACION_SALA
            };

            salas.set(pin, sala);
            socket.join(pin);
            socket.data.pin = pin;
            socket.data.esModerador = true;

            console.log('Sala creada:', { pin, nombre });
            socket.emit('sala_creada', {
                pin,
                productos: Array.from(sala.productos.values())
            });
        } catch (error) {
            console.error('Error al crear sala:', error);
            socket.emit('error', 'Error al crear la sala: ' + error.message);
        }
    });

    // Agregar un producto a la sala
    socket.on('agregar_producto', ({ pin, producto }) => {
        try {
            const sala = salas.get(pin);
            if (!sala || socket.id !== sala.moderador) {
                throw new Error('No autorizado');
            }

            if (!validarProducto(producto)) {
                throw new Error('Datos de producto inválidos');
            }

            const id = generarIdProducto();
            const productoCompleto = {
                id,
                ...producto,
                ofertaActual: producto.precioInicial,
                lider: null,
                estado: 'pendiente',
                historialOfertas: []
            };

            sala.productos.set(id, productoCompleto);
            console.log('Producto agregado:', productoCompleto);
            io.to(pin).emit('producto_agregado', productoCompleto);
        } catch (error) {
            console.error('Error al agregar producto:', error);
            socket.emit('error', 'Error al agregar producto: ' + error.message);
        }
    });

    // Unirse a sala
    socket.on('unirse_sala', ({ pin, nombre }) => {
        console.log('Intento de unirse a sala:', { pin, nombre });
        const sala = salas.get(pin);
        
        if (!sala) {
            console.error('Sala no encontrada:', pin);
            socket.emit('error', 'La sala no existe');
            return;
        }

        // Verificar si el participante ya está en la sala
        if (sala.participantes.has(nombre)) {
            const participante = sala.participantes.get(nombre);
            if (participante.socketId === socket.id) {
                // Es la misma conexión, solo actualizar datos
                socket.data.pin = pin;
                socket.data.nombre = nombre;
                socket.join(pin);
                
                // Enviar estado actual
                const estadoInicial = {
                    pin: pin,
                    productos: Array.from(sala.productos.values()),
                    participante: nombre
                };
                socket.emit('estado_inicial', estadoInicial);
                return;
            } else {
                console.error('Nombre ya en uso:', nombre);
                socket.emit('error', 'Este nombre ya está en uso');
                return;
            }
        }

        // Unir al participante a la sala
        socket.join(pin);
        socket.data.pin = pin;
        socket.data.nombre = nombre;
        sala.participantes.set(nombre, {
            socketId: socket.id,
            nombre: nombre
        });

        console.log('Participante unido exitosamente:', { pin, nombre });

        // Enviar estado inicial
        const estadoInicial = {
            pin: pin,
            productos: Array.from(sala.productos.values()),
            participante: nombre
        };
        socket.emit('estado_inicial', estadoInicial);
    });

    // Nueva oferta
    socket.on('nueva_oferta', ({ monto }) => {
        try {
            const pin = socket.data.pin;
            const nombre = socket.data.nombre;
            const sala = salas.get(pin);

            if (!sala) throw new Error('Sala no encontrada');

            const productoActivo = Array.from(sala.productos.values())
                .find(p => p.estado === 'activo');

            if (!productoActivo) throw new Error('No hay ninguna subasta activa');

            if (typeof monto !== 'number' || monto <= productoActivo.ofertaActual) {
                throw new Error('La oferta debe ser mayor a la actual');
            }

            productoActivo.ofertaActual = monto;
            productoActivo.lider = nombre;
            productoActivo.historialOfertas.push({
                participante: nombre,
                monto,
                timestamp: Date.now()
            });

            io.to(pin).emit('actualizar_oferta', {
                producto: productoActivo.nombre,
                oferta: monto,
                lider: nombre,
                historial: productoActivo.historialOfertas // <- Esto ya se emite
            });
        } catch (error) {
            socket.emit('error_oferta', error.message);
        }
    });


    // Iniciar subasta de un producto
    socket.on('iniciar_subasta', ({ pin, productoId }) => {
        try {
            console.log('Intentando iniciar subasta:', { pin, productoId });
            const sala = salas.get(pin);
            if (!sala) {
                throw new Error('Sala no encontrada');
            }

            // Verificar si el socket es el moderador de esta sala
            if (socket.data.pin !== pin || !socket.data.esModerador) {
                throw new Error('No autorizado');
            }

            const producto = sala.productos.get(productoId);
            if (!producto) {
                throw new Error('Producto no encontrado');
            }

            // Finalizar cualquier subasta activa
            for (const p of sala.productos.values()) {
                if (p.estado === 'activo') {
                    p.estado = 'finalizado';
                    io.to(pin).emit('estado_subasta_cambiado', {
                        id: p.id,
                        estado: 'finalizado',
                        producto: p.nombre,
                        oferta: p.ofertaActual,
                        lider: p.lider
                    });
                }
            }

            producto.estado = 'activo';
            console.log('Subasta iniciada:', { producto: producto.nombre });

            io.to(pin).emit('estado_subasta_cambiado', {
                id: productoId,
                estado: 'activo',
                producto: producto.nombre,
                oferta: producto.ofertaActual,
                lider: producto.lider
            });
        } catch (error) {
            console.error('Error al iniciar subasta:', error);
            socket.emit('error', 'Error al iniciar subasta: ' + error.message);
        }
    });

    // Finalizar subasta de un producto
    socket.on('finalizar_subasta', ({ pin, productoId }) => {
        try {
            const sala = salas.get(pin);
            if (!sala) {
                throw new Error('Sala no encontrada');
            }

            // Verificar si el socket es el moderador de esta sala
            if (socket.data.pin !== pin || !socket.data.esModerador) {
                throw new Error('No autorizado');
            }

            const producto = sala.productos.get(productoId);
            if (!producto) {
                throw new Error('Producto no encontrado');
            }

            producto.estado = 'finalizado';
            console.log('Subasta finalizada:', { producto: producto.nombre });

            io.to(pin).emit('estado_subasta_cambiado', {
                id: productoId,
                estado: 'finalizado',
                producto: producto.nombre,
                oferta: producto.ofertaActual,
                lider: producto.lider
            });
        } catch (error) {
            console.error('Error al finalizar subasta:', error);
            socket.emit('error', 'Error al finalizar subasta: ' + error.message);
        }
    });

    // Recuperar sala
    socket.on('recuperar_sala', () => {
        try {
            const pin = socket.data.pin;
            if (!pin) return;

            const sala = salas.get(pin);
            if (!sala) {
                throw new Error('Sala no encontrada');
            }

            if (socket.data.esModerador) {
                socket.emit('sala_creada', {
                    pin,
                    productos: Array.from(sala.productos.values())
                });
            } else {
                socket.emit('estado_inicial', {
                    nombre: sala.nombre,
                    productos: Array.from(sala.productos.values())
                });
            }
        } catch (error) {
            socket.emit('error', 'Error al recuperar sala: ' + error.message);
        }
    });

    // Desconexión
    socket.on('disconnect', () => {
        const pin = socket.data.pin;
        const nombre = socket.data.nombre;
        
        if (pin && nombre) {
            const sala = salas.get(pin);
            if (sala) {
                sala.participantes.delete(nombre);
                
                // Si no quedan participantes y no hay moderador, eliminar la sala
                if (sala.participantes.size === 0 && !sala.moderador) {
                    salas.delete(pin);
                }
            }
        }
    });
});

// Manejo de errores global
process.on('uncaughtException', (error) => {
    console.error('Error no manejado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promesa rechazada no manejada:', error);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
