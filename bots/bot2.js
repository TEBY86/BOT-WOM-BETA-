const puppeteer = require('puppeteer-extra'); // Importa Puppeteer con soporte para plugins
const StealthPlugin = require('puppeteer-extra-plugin-stealth'); // Plugin para evitar detección como bot
require('dotenv').config(); // Carga variables de entorno desde .env

puppeteer.use(StealthPlugin()); // Aplica el plugin de stealth para evitar bloqueos en el sitio

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
 * NOTA: Esta función solo es relevante si headless: false. En headless: true, no tiene efecto visual.
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
  // ¡IMPORTANTE! La declaración de 'log' DEBE estar al principio de la función bot2
  const log = (msg) => console.log(`[BOT2] ${msg}`);

  const [region, comuna, calle, numero, torre, depto] = input.split(',').map(x => x.trim());

  // --- DEBUG LOGS: Valores de entrada ---
  log(`Iniciando bot2 con input: "${input}"`);
  log(`DEBUG: Región: "${region}", Comuna: "${comuna}", Calle: "${calle}", Número: "${numero}"`);
  log(`DEBUG: Torre: "${torre}", Depto: "${depto}"`);
  // --- FIN DEBUG LOGS ---

  if (!region || !comuna || !calle || !numero) {
    return ctx.reply('❗ Formato incorrecto. Usa: /factibilidad Región, Comuna, Calle, Número[, Torre[, Depto]]');
  }

  ctx.reply('🔍 Consultando factibilidad técnica en MAT de WOM, un momento...');

  // Función para tomar captura de pantalla (útil para depuración)
  async function tomarCapturaBuffer(page, caption = 'Captura de pantalla de depuración.') {
    try {
      const buffer = await page.screenshot({ fullPage: true });
      await ctx.replyWithPhoto({ source: buffer }, { caption: caption });
      log(`✅ Captura de pantalla tomada: ${caption}`);
    } catch (screenshotError) {
      log(`⚠️ No se pudo tomar captura de pantalla: ${screenshotError.message}`);
    }
  }

  let browser;
  try {
    log('Lanzando navegador Puppeteer...');
    browser = await puppeteer.launch({
      headless: true, // ✅ CAMBIO CLAVE: Ejecutar en modo headless para entornos de servidor
      slowMo: 20, // Ralentiza las operaciones para depuración (opcional en producción)
      args: [
        '--no-sandbox', // Necesario para algunos entornos de servidor como Docker/Railway
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Soluciona problemas de memoria en Docker
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800' // Tamaño de ventana virtual
      ],
      defaultViewport: null, // Permite que el viewport se ajuste al tamaño de la ventana
    });

    const page = await browser.newPage();
    log('Navegador lanzado, nueva página creada.');

    // Añadir listeners para depuración de carga de página y errores de red
    page.on('console', (msg) => log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
    page.on('pageerror', (err) => log(`[PAGE ERROR] ${err.message}`));
    page.on('response', (response) => log(`[PAGE RESPONSE] URL: ${response.url()} | Status: ${response.status()}`));
    page.on('requestfailed', request => {
        log(`[REQUEST FAILED] URL: ${request.url()} | Error: ${request.failure().errorText}`);
    });
    page.on('error', (err) => log(`[BROWSER ERROR] ${err.message}`));
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    log('User Agent configurado.');

    // Obtener variables de entorno
    const womLoginUrl = process.env.WOM_LOGIN_URL;
    const womDireccionUrl = process.env.WOM_DIRECCION_URL;
    const womUser = process.env.WOM_USER;
    const womPass = process.env.WOM_PASS;

    // Loguear estado de las variables de entorno
    log(`WOM_LOGIN_URL: ${womLoginUrl ? 'Definido' : 'UNDEFINED'}`);
    log(`WOM_DIRECCION_URL: ${womDireccionUrl ? 'Definido' : 'UNDEFINED'}`);
    log(`WOM_USER: ${womUser ? 'Definido' : 'UNDEFINED'}`);
    log(`WOM_PASS: ${womPass ? 'Definido' : 'UNDEFINED'}`);

    // Verificar que las variables de entorno cruciales estén definidas
    if (!womLoginUrl || !womUser || !womPass || !womDireccionUrl) {
        throw new Error('Variables de entorno de WOM (URL, USER, PASS) no están definidas. Por favor, revisa la configuración en Railway.');
    }

    log(`Navegando a la URL de inicio de sesión: ${womLoginUrl}`);
    try {
        // Aumentar el tiempo de espera a 90 segundos y cambiar waitUntil a 'domcontentloaded'
        await page.goto(womLoginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        log(`Página de inicio de sesión cargada. URL actual: ${page.url()}`);
    } catch (navigationError) {
        log(`❌ ERROR DE NAVEGACIÓN (LOGIN): No se pudo cargar la página de WOM. Detalles: ${navigationError.message}`);
        await ctx.reply(`❌ Error al cargar la página de inicio de sesión de WOM: ${navigationError.message}.`);
        await tomarCapturaBuffer(page, 'Captura de pantalla al fallar la navegación inicial.');
        const pageHtml = await page.content();
        log('Contenido HTML de la página al fallar la navegación inicial (primeras 500 chars):', pageHtml.substring(0, 500));
        if (browser) await browser.close();
        return;
    }

    // Pasos de interacción para el login
    const pasosLogin = [
        { selector: '#username', type: 'type', value: womUser, name: 'Usuario' },
        { selector: '#password', type: 'type', value: womPass, name: 'Contraseña' },
        { selector: '#kc-login', type: 'click', name: 'Botón Ingresar' }
    ];

    for (const paso of pasosLogin) {
        log(`Ejecutando paso de login: ${paso.name} (Selector: ${paso.selector})`);
        await page.waitForSelector(paso.selector, { visible: true, timeout: 15000 });
        const element = await page.$(paso.selector);
        if (element) {
            if (paso.type === 'type') {
                await element.click({ clickCount: 3 }); // Triple click para seleccionar todo
                await element.press('Backspace'); // Borrar contenido existente
                await element.type(paso.value);
                log(`Texto ingresado en ${paso.name}.`); // No loguear el valor por seguridad
            } else if (paso.type === 'click') {
                await element.click();
                log(`Click en ${paso.name}.`);
            }
        } else {
            throw new Error(`Elemento de login no encontrado: ${paso.selector}`);
        }
        await page.waitForTimeout(500); // Pequeña pausa entre pasos
    }

    log('Inicio de sesión completado. Esperando navegación o elementos post-login...');
    // Esperar la navegación o un selector específico después del login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => log('No hubo navegación explícita después del login o timeout.'));
    log(`URL actual después del login: ${page.url()}`);

    log(`Navegando a la URL de dirección: ${womDireccionUrl}`);
    try {
        // Esta es la línea donde se navega a la página de dirección.
        // Asegúrate de que `process.env.WOM_DIRECCION_URL` contenga la URL correcta.
        await page.goto(womDireccionUrl, { waitUntil: 'networkidle2', timeout: 90000 }); // <-- Línea para cambiar si es necesario
        log(`Página de dirección cargada. URL actual: ${page.url()}`);
    } catch (navigationError) {
        log(`❌ ERROR DE NAVEGACIÓN (DIRECCIÓN): No se pudo cargar la página de dirección de WOM. Detalles: ${navigationError.message}`);
        await ctx.reply(`❌ Error al cargar la página de dirección de WOM: ${navigationError.message}.`);
        await tomarCapturaBuffer(page, 'Captura de pantalla al fallar la navegación a la página de dirección.');
        const pageHtml = await page.content();
        log('Contenido HTML de la página al fallar la navegación a la dirección (primeras 500 chars):', pageHtml.substring(0, 500));
        if (browser) await browser.close();
        return;
    }

    // Rellenar la dirección
    log(`Ingresando dirección: ${calle} ${numero}`);
    await page.waitForSelector('input#direccion', { visible: true, timeout: 15000 });
    const inputDireccion = await page.$('input#direccion');
    await inputDireccion.click({ clickCount: 3 }); // Seleccionar todo el texto
    await inputDireccion.press('Backspace'); // Borrar el contenido
    await page.waitForTimeout(500); // Pequeña pausa

    // ✅ CAMBIO CLAVE: Usar la calle y número de la entrada del usuario
    await inputDireccion.type(`${calle} ${numero}`, { delay: 100 });
    await page.waitForTimeout(2000); // Esperar sugerencias

    // Seleccionar la primera sugerencia si aparece
    // Usar una parte de la calle para la búsqueda, insensible a mayúsculas/minúsculas
    const calleBusqueda = calle.substring(0, Math.min(calle.length, 8)).toLowerCase(); // Tomar los primeros 8 caracteres o menos
    const sugerenciaSelector = `//li[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚ', 'abcdefghijklmnopqrstuvwxyzáéíóú'), '${calleBusqueda}')]`;
    log(`Buscando sugerencia con XPath: ${sugerenciaSelector}`);
    const [sugerencia] = await page.$x(sugerenciaSelector);

    if (sugerencia) {
        log('Sugerencia encontrada, haciendo click.');
        await sugerencia.click();
        await page.waitForTimeout(2000); // Esperar que la selección se procese
    } else {
        log('⚠️ No se encontró sugerencia de autocompletado para la dirección. Continuando...');
    }

    // Pasos finales de interacción en la página de dirección
    const pasosFinales = [
        { selector: '#btnContinuar', type: 'click', name: 'Botón Continuar' },
        { selector: '#btnVerificar', type: 'click', name: 'Botón Verificar' }
    ];

    for (const paso of pasosFinales) {
        log(`Ejecutando paso final: ${paso.name} (Selector: ${paso.selector})`);
        await page.waitForSelector(paso.selector, { visible: true, timeout: 15000 });
        const element = await page.$(paso.selector);
        if (element) {
            await element.click();
            log(`Click en ${paso.name}.`);
        } else {
            throw new Error(`Elemento final no encontrado: ${paso.selector}`);
        }
        await page.waitForTimeout(1000); // Pequeña pausa
    }

    log('Proceso de verificación de factibilidad completado.');
    await ctx.reply('✅ Verificación de factibilidad finalizada. Revisa el resultado en el sistema WOM.');

    // Intenta tomar captura del modal de resultado o de la página completa
    try {
      await page.waitForSelector('section.modal_cnt.container-row', { visible: true, timeout: 15000 }); 
      const modal = await page.$('section.modal_cnt.container-row');
      const buffer = await modal.screenshot();
      await ctx.replyWithPhoto({ source: buffer, caption: 'Resultado de factibilidad.' });
      log('✅ Captura del modal de resultado tomada.');
    } catch (e) {
      log('⚠️ Modal de resultado no detectado o no apareció a tiempo. Se tomará pantalla completa.');
      await tomarCapturaBuffer(page, 'Captura de pantalla completa del resultado.'); 
    }

  } catch (e) {
    console.error('❌ Error general en bot2:', e);
    await ctx.reply(`⚠️ Error inesperado durante la verificación: ${e.message || 'Error desconocido'}. Intenta nuevamente o revisa los datos.`);
  } finally {
    if (browser) {
      await browser.close();
      log('Navegador cerrado.');
    }
  }
}

module.exports = { bot2 }; // Exporta la función para que GESTOR.js pueda usarla