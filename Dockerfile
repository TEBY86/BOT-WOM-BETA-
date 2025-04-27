# Imagen base con Node 20 + Debian Bookworm
FROM node:20-bookworm-slim

# 1. Instala dependencias esenciales para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Configuración de Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# 3. Directorio de trabajo
WORKDIR /app

# 4. Copia e instala dependencias (usa cache de Docker)
COPY package*.json .
RUN npm install --production

# 5. Copia el resto del código
COPY . .

# 6. Comando de inicio
CMD ["npm", "start"]