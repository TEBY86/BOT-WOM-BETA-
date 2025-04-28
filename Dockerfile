# Imagen base: Node.js 20 slim basada en Debian Bookworm
FROM node:20-bookworm-slim

# Instalación de dependencias de sistema necesarias para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libxrandr2 \
    libxss1 \
    libgtk-3-0 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configuración de variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json primero para aprovechar el caché
COPY package.json package-lock.json ./

# Instalar dependencias de Node.js
RUN npm install

# Copiar el resto del proyecto
COPY . .

# Comando de inicio
CMD ["npm", "start"]