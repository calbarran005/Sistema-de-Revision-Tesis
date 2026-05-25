#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Deteniendo SisTesis...${NC}"

fuser -k 3001/tcp &>/dev/null && echo -e "${GREEN}  ✓ API detenida${NC}"
fuser -k 3000/tcp &>/dev/null && echo -e "${GREEN}  ✓ Frontend detenido${NC}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" && docker compose stop 2>/dev/null && echo -e "${GREEN}  ✓ Docker (MinIO) detenido${NC}"

echo -e "${GREEN}Sistema detenido.${NC}"
