#!/bin/bash

# ─── Colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}        SisTesis — Iniciando sistema                  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ─── 1. Redis ─────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[1/4] Verificando Redis...${NC}"
if redis-cli ping &>/dev/null; then
  echo -e "${GREEN}  ✓ Redis ya está corriendo${NC}"
else
  sudo systemctl start redis 2>/dev/null || sudo service redis-server start 2>/dev/null
  sleep 2
  if redis-cli ping &>/dev/null; then
    echo -e "${GREEN}  ✓ Redis iniciado${NC}"
  else
    echo -e "${RED}  ✗ Redis no pudo iniciarse — verifica manualmente${NC}"
  fi
fi

# ─── 2. Docker (MinIO) ────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[2/4] Iniciando Docker (MinIO)...${NC}"
if docker info &>/dev/null; then
  cd "$ROOT_DIR" && docker compose up -d 2>/dev/null
  echo -e "${GREEN}  ✓ MinIO en http://localhost:9001${NC}"
else
  echo -e "${RED}  ✗ Docker no está corriendo — ejecuta: sudo systemctl start docker${NC}"
fi

# ─── 3. MySQL (XAMPP) ─────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[3/4] Verificando MySQL (XAMPP)...${NC}"
if /opt/lampp/bin/mysql -u root -e "SELECT 1" &>/dev/null; then
  echo -e "${GREEN}  ✓ MySQL ya está corriendo${NC}"
else
  echo -e "${YELLOW}  MySQL no responde. Intentando iniciar XAMPP...${NC}"
  echo -e "${YELLOW}  (puede pedir contraseña sudo)${NC}"
  sudo /opt/lampp/lampp startmysql 2>/dev/null
  sleep 3
  if /opt/lampp/bin/mysql -u root -e "SELECT 1" &>/dev/null; then
    echo -e "${GREEN}  ✓ MySQL iniciado${NC}"
  else
    echo -e "${RED}  ✗ MySQL no pudo iniciarse — inicia XAMPP manualmente${NC}"
  fi
fi

# ─── 4. API y Frontend ────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[4/4] Levantando API y Frontend...${NC}"

# Liberar puertos si ya están en uso
fuser -k 3001/tcp &>/dev/null
fuser -k 3000/tcp &>/dev/null
sleep 1

# API en modo dev (recarga automática al guardar cambios)
cd "$ROOT_DIR/apps/api"
npm run dev > /tmp/santos-api.log 2>&1 &
API_PID=$!
echo -e "${GREEN}  ✓ API iniciando (PID $API_PID) → logs: /tmp/santos-api.log${NC}"

# Frontend en background
cd "$ROOT_DIR/apps/web"
npm run dev > /tmp/santos-web.log 2>&1 &
WEB_PID=$!
echo -e "${GREEN}  ✓ Frontend iniciando (PID $WEB_PID) → logs: /tmp/santos-web.log${NC}"

# ─── Esperar y confirmar ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}Esperando que los servidores estén listos...${NC}"
sleep 15

API_OK=false
WEB_OK=false

for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/auth/login -X POST \
    -H "Content-Type: application/json" -d '{}' 2>/dev/null | grep -q "400\|401\|200" && API_OK=true && break
  sleep 2
done

for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|307" && WEB_OK=true && break
  sleep 2
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                   Estado final                       ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
$API_OK && echo -e "${GREEN}  ✓ API        → http://localhost:3001/api/v1${NC}" \
        || echo -e "${RED}  ✗ API        → no responde (revisa /tmp/santos-api.log)${NC}"
$WEB_OK && echo -e "${GREEN}  ✓ Frontend   → http://localhost:3000${NC}" \
        || echo -e "${RED}  ✗ Frontend   → no responde (revisa /tmp/santos-web.log)${NC}"
echo -e "${GREEN}  ✓ Swagger    → http://localhost:3001/api/docs${NC}"
echo -e "${GREEN}  ✓ MinIO      → http://localhost:9001${NC}"
echo ""
echo -e "${BLUE}  Credenciales de prueba:${NC}"
echo -e "  Admin:       admin@universidad.edu.co     / Admin123!"
echo -e "  Coordinador: coordinador@universidad.edu.co / Coord123!"
echo -e "  Asesor:      asesor@universidad.edu.co    / Asesor123!"
echo -e "  Estudiante:  estudiante@universidad.edu.co / Student123!"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Para detener todo: ${YELLOW}bash stop.sh${NC}"
echo -e "Logs en vivo:      ${YELLOW}tail -f /tmp/santos-api.log${NC}"
