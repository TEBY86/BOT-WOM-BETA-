// bots/bot2.js (CONTENIDO CORREGIDO PARA MODO HEADLESS)

require('dotenv').config(); // Carga variables de entorno para bot2.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

/**
 * Función auxiliar para verificar si un texto contiene palabras clave de departamento.
 * @param {string} texto - El texto a verificar.
 * @returns {boolean} True si contiene palabras clave de departamento, false en caso contrario.
 */
function contieneDepartamento(texto) {
    const palabrasClave = [
        'torre', 'depto', 'dpto', 'piso', 'casa', 'block', 'edificio',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
    ];
    const textoNormalizado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return palabrasClave.some(palabra => textoNormalizado.includes(palabra));
}

/**
 * Simula visualmente el movimiento del cursor en la página (para depuración).
 * @param {object} page - La instancia de la página de Puppeteer.
 * @param {number} x - Coordenada X.
 * @param {number} y - Coordenada Y.
 */
async function actualizarCursorRojo(page, x, y) {
    await page.evaluate((x, y) => {
        let cursor = document.getElementById('puppeteer-cursor');
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = 'puppeteer-cursor';
            cursor.style.position = 'absolute';
            cursor.style.width = '10px';
            cursor.style.height = '10px';
            cursor.style.borderRadius = '50%';
            cursor.style.backgroundColor = 'red';
            cursor.style.zIndex = '99999';
            cursor.style.pointerEvents = 'none';
            cursor.style.transition = 'transform 0.1s ease-out';
            document.body.appendChild(cursor);
        }
        cursor.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
    }, x, y);
}

/**
 * Automatiza la verificación de factibilidad en el sistema WOM.
 * @param {object} ctx - Objeto de contexto de Telegraf para responder al usuario.
 * @param {string} input - La dirección en formato "Región, Comuna, Calle, Número, Torre, Depto".
 */
async function bot2(ctx, input) {
    console.log(`[BOT2] Iniciando bot2 con input: "${input}"`); // Log de inicio de bot2

    const [region, comuna, calle, numero, torre, depto] = input.split(',').map(s => s.trim());

    if (!region || !comuna || !calle || !numero) {
        console.error('[BOT2] Error: Faltan datos obligatorios de la dirección.');
        return ctx.reply('⚠️ Error: Por favor, proporciona Región, Comuna, Calle y Número.');
    }

    let browser;
    try {
        await ctx.reply('⏳ Iniciando verificación de factibilidad en el sistema WOM...');
        console.log('[BOT2] Lanzando navegador...');

        browser = await puppeteer.launch({
            // ✅ CAMBIO CLAVE: Ejecutar en modo headless (sin interfaz gráfica)
            headless: true, // Cambiado a true
            slowMo: 20, // Ralentiza las operaciones para observabilidad (útil incluso en headless para depuración lógica)
            args: [
                '--no-sandbox', // Necesario para algunos entornos de servidor
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Soluciona problemas de memoria en Docker
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800' // Tamaño de ventana por defecto
            ],
            defaultViewport: null // Permite que el viewport se ajuste al tamaño de la ventana
        });

        const page = await browser.newPage();
        console.log('[BOT2] Navegador lanzado, nueva página creada.');

        // Inyectar la función del cursor rojo para depuración visual (solo si headless es false)
        if (browser.process().spawnargs.includes('--headless=new') || browser.process().spawnargs.includes('--headless')) {
             console.log('[BOT2] Ejecutando en modo headless, el cursor rojo no será visible.');
        } else {
            await page.evaluateOnNewDocument(() => {
                window.actualizarCursorRojo = (x, y) => {
                    let cursor = document.getElementById('puppeteer-cursor');
                    if (!cursor) {
                        cursor = document.createElement('div');
                        cursor.id = 'puppeteer-cursor';
                        cursor.style.position = 'absolute';
                        cursor.style.width = '10px';
                        cursor.style.height = '10px';
                        cursor.style.borderRadius = '50%';
                        cursor.style.backgroundColor = 'red';
                        cursor.style.zIndex = '99999';
                        cursor.style.pointerEvents = 'none';
                        cursor.style.transition = 'transform 0.1s ease-out';
                        document.body.appendChild(cursor);
                    }
                    cursor.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
                };
            });
            await page.exposeFunction('registrarClick', async (x, y) => {
                console.log(`[BOT2] Click registrado en: (${x}, ${y})`);
                await actualizarCursorRojo(page, x, y);
            });
        }

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        console.log('[BOT2] User Agent configurado.');

        console.log('[BOT2] Navegando a la URL de inicio de sesión...');
        await page.goto(process.env.WOM_LOGIN_URL || 'https://example.com/login', { waitUntil: 'networkidle2' });
        console.log('[BOT2] Página de inicio de sesión cargada.');

        // Definir los pasos de interacción
        const pasos = [
            { selector: '#usuario', type: 'type', value: process.env.WOM_USER, name: 'Usuario' },
            { selector: '#password', type: 'type', value: process.env.WOM_PASS, name: 'Contraseña' },
            { selector: '#datoUsuarioRut', type: 'type', value: '16384931-3', name: 'RUT' }, // RUT codificado
            { selector: '#btnIngresar', type: 'click', name: 'Botón Ingresar' }
        ];

        for (const paso of pasos) {
            console.log(`[BOT2] Ejecutando paso: ${paso.name}`);
            await page.waitForSelector(paso.selector, { visible: true, timeout: 15000 });
            const element = await page.$(paso.selector);
            if (element) {
                const box = await element.boundingBox();
                if (box) {
                    const x = box.x + box.width / 2;
                    const y = box.y + box.height / 2;

                    if (!browser.process().spawnargs.includes('--headless=new') && !browser.process().spawnargs.includes('--headless')) {
                        await page.mouse.move(x, y);
                        await actualizarCursorRojo(page, x, y);
                    }
                }

                if (paso.type === 'type') {
                    await element.click(); // Asegurarse de que el campo esté enfocado
                    await page.keyboard.down('Control'); // Seleccionar todo el texto
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Delete'); // Borrar el contenido
                    await element.type(paso.value);
                    console.log(`[BOT2] Texto "${paso.value}" ingresado en ${paso.name}.`);
                } else if (paso.type === 'click') {
                    await element.click();
                    console.log(`[BOT2] Click en ${paso.name}.`);
                }
            } else {
                throw new Error(`Elemento no encontrado: ${paso.selector}`);
            }
            await page.waitForTimeout(500); // Pequeña pausa entre pasos
        }

        console.log('[BOT2] Inicio de sesión completado. Navegando a la página de dirección...');
        // Esperar la navegación o un selector específico después del login
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => console.log('[BOT2] No hubo navegación después del login o timeout.'));

        // Navegar directamente a la URL de dirección si es necesario, o esperar la redirección
        // Asegúrate de que esta URL sea la correcta después del login
        await page.goto(process.env.WOM_DIRECCION_URL || 'https://sso-ocp4-sr-amp.apps.sr-ocp.wom.cl/auth/realms/customer-care/protocol/openid-connect/auth?client_id=e7c0d592&redirect_uri=https%3A%2F%2Fcustomercareapplicationservice.ose.wom.cl%2Fwomac%2F&state=e42c40c3-f0d7-47c6-8ecd-4d97b22d18e1&response_mode=fragment&response_type=code&scope=openid&nonce=bfed0801-0131-4ec3-bf0b-1bd571658271', { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('[BOT2] Página de dirección cargada.');

        // Rellenar la dirección
        console.log(`[BOT2] Ingresando dirección: ${calle} ${numero}`);
        await page.waitForSelector('#direccion', { visible: true, timeout: 15000 });
        await page.type('#direccion', `${calle} ${numero}`);
        await page.waitForTimeout(1000); // Esperar sugerencias

        // Seleccionar la primera sugerencia si aparece
        const sugerenciaSelector = `//li[contains(., '${calle.substring(0, 5).toLowerCase()}') or contains(., '${calle.substring(0, 5).toUpperCase()}')]`;
        console(`[BOT2] Buscando sugerencia con XPath: ${sugerenciaSelector}`);
        const [sugerencia] = await page.$x(sugerenciaSelector);

        if (sugerencia) {
            console.log('[BOT2] Sugerencia encontrada, haciendo click.');
            await sugerencia.click();
            await page.waitForTimeout(2000); // Esperar que la selección se procese
        } else {
            console.warn('[BOT2] No se encontró sugerencia de autocompletado para la dirección. Continuando...');
        }

        // Pasos finales de interacción en la página de dirección
        const pasosFinales = [
            { selector: '#btnContinuar', type: 'click', name: 'Botón Continuar' },
            { selector: '#btnVerificar', type: 'click', name: 'Botón Verificar' }
        ];

        for (const paso of pasosFinales) {
            console.log(`[BOT2] Ejecutando paso final: ${paso.name}`);
            await page.waitForSelector(paso.selector, { visible: true, timeout: 15000 });
            const element = await page.$(paso.selector);
            if (element) {
                const box = await element.boundingBox();
                if (box) {
                    const x = box.x + box.width / 2;
                    const y = box.y + box.height / 2;
                    if (!browser.process().spawnargs.includes('--headless=new') && !browser.process().spawnargs.includes('--headless')) {
                        await page.mouse.move(x, y);
                        await actualizarCursorRojo(page, x, y);
                    }
                }
                await element.click();
                console.log(`[BOT2] Click en ${paso.name}.`);
            } else {
                throw new Error(`Elemento final no encontrado: ${paso.selector}`);
            }
            await page.waitForTimeout(1000); // Pequeña pausa
        }

        console.log('[BOT2] Proceso de verificación de factibilidad completado.');
        await ctx.reply('✅ Verificación de factibilidad finalizada. Revisa el resultado en el sistema WOM.');

        // Aquí podrías añadir lógica para extraer el resultado de la factibilidad de la página
        // Por ejemplo:
        // const resultadoFactibilidad = await page.evaluate(() => {
        //     const elementoResultado = document.querySelector('#idDelElementoResultado');
        //     return elementoResultado ? elementoResultado.textContent : 'No se pudo obtener el resultado.';
        // });
        // await ctx.reply(`Resultado: ${resultadoFactibilidad}`);

    } catch (error) {
        console.error('[BOT2] Error general:', error);
        await ctx.reply(`❌ Error al realizar la verificación: ${error.message || 'Error desconocido'}. Por favor, intenta de nuevo más tarde.`);
    } finally {
        if (browser) {
            await browser.close();
            console.log('[BOT2] Navegador cerrado.');
        }
    }
}

module.exports = { bot2 }; // Exporta la función para que GESTOR.js pueda usarla