# Imagen base
FROM node:20-bookworm-slim

# 1. Instalación de dependencias de sistema
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Configuración Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# 3. Crear directorio app
WORKDIR /app

# 4. Copiar solo package.json primero
COPY package.json package-lock.json ./

# 5. Instalar dependencias
RUN npm install

# 6. Copiar todo el resto del proyecto
COPY . .

# 7. Puerto que usa su app (opcional)
EXPOSE 3000

# 8. Comando de inicio
CMD ["npm", "start"]
