# Sistema de Revisión de Tesis — Gestión y Evaluación Inteligente de Avances de Tesis

Sistema completo de revisión automatizada con IA para avances de tesis universitarias.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, shadcn/ui, Recharts |
| Backend | NestJS 10, TypeScript, Swagger |
| Base de datos | **MySQL vía XAMPP** (Prisma ORM) |
| IA | OpenAI GPT-4o-mini / Ollama (configurable) |
| Colas | BullMQ + Redis |
| Almacenamiento | Cloudflare R2 / MinIO (S3-compatible) |
| Email | Nodemailer + MailHog (dev) |

---

## Requisitos Previos

- **Node.js** v20+ (instalado: v24) — `node --version`
- **XAMPP** corriendo con MySQL en puerto 3306
- **Docker** + Docker Compose (para Redis y MinIO)
- **Git**

---

## Instalación Paso a Paso

### 1. Clonar y configurar variables de entorno

```bash
cd ""
cp .env.example .env
# Editar .env con tus valores (ver sección Variables de Entorno)
```

### 2. Crear base de datos en XAMPP

Abre phpMyAdmin (http://localhost/phpmyadmin) y ejecuta:

```sql
CREATE DATABASE tesis_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

O desde terminal:
```bash
mysql -u root -e "CREATE DATABASE tesis_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. Levantar servicios Docker (Redis + MinIO)

```bash
docker compose up -d
```

Verifica que estén corriendo:
- Redis: `redis-cli -p 6379 ping` → `PONG`
- MinIO UI: http://localhost:9001 (usuario: `santos_admin` / pass: `santos_minio_2024`)
- MailHog UI: http://localhost:8025

### 4. Instalar dependencias

```bash
# En la raíz del monorepo
npm install

# Instalar dependencias de cada app
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
cd packages/database && npm install && cd ../..
```

### 5. Generar cliente Prisma y migrar DB

```bash
cd packages/database

# Copiar .env al packages/database también
cp ../../.env .env

# Generar cliente Prisma
npx prisma generate

# Aplicar schema a MySQL
npx prisma db push

# Poblar datos de prueba
npx ts-node prisma/seed.ts

cd ../..
```

### 6. Iniciar la aplicación

Terminal 1 — Backend:
```bash
cd apps/api
cp ../../.env .env
npm run dev
```

Terminal 2 — Frontend:
```bash
cd apps/web
cp ../../.env.example .env.local
# Editar NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
npm run dev
```

---

## Acceso

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API REST | http://localhost:3001/api/v1 |
| Swagger Docs | http://localhost:3001/api/docs |
| MinIO Console | http://localhost:9001 |
| MailHog | http://localhost:8025 |
| API (producción) | https://tesisrevision-api.onrender.com/api/v1 |
| Frontend (producción) | https://tesisrevision-web.onrender.com |

### Usuarios de Prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@universidad.edu.co | Admin123! |
| Coordinador | coordinador@universidad.edu.co | Coord123! |
| Asesor | asesor@universidad.edu.co | Asesor123! |
| Estudiante | estudiante@universidad.edu.co | Student123! |

---

## Variables de Entorno Clave

```env
# DB MySQL (XAMPP)
DATABASE_URL="mysql://root:@localhost:3306/tesis_db"

# OpenAI (obtener en platform.openai.com)
OPENAI_API_KEY=""
AI_MODEL="gpt-4o-mini"          # gpt-4o para mayor calidad

# Redis (Docker)
REDIS_URL="redis://:redis_pass_2024@localhost:6379"

# Storage (local: MinIO / producción: Cloudflare R2)
MINIO_ENDPOINT="localhost"           # prod: <ACCOUNT_ID>.r2.cloudflarestorage.com
MINIO_ACCESS_KEY="santos_admin"      # prod: Access Key ID de R2
MINIO_SECRET_KEY="santos_minio_2024" # prod: Secret Access Key de R2
```

### Modo sin OpenAI (Ollama local gratuito)

```env
AI_PROVIDER="ollama"
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1:8b"
```

Instalar Ollama: https://ollama.ai → `ollama pull llama3.1:8b`

---

## Flujo del Sistema

```
Estudiante sube PDF/Word
        ↓
   MinIO Storage
        ↓
  BullMQ Queue (Redis)
        ↓
  AI Worker (NestJS)
    ├── pdf-parse / mammoth → extrae texto
    ├── GPT-4o → analiza estructura vs template
    ├── GPT-4o → evalúa contenido por sección
    ├── GPT-4o → genera resumen ejecutivo
    └── Calcula: estructura(30%) + contenido(40%) + forma(20%) + originalidad(10%)
        ↓
  DB MySQL → guarda análisis + hallazgos
        ↓
  WebSocket → notifica al estudiante
        ↓
  Asesor revisa en panel lado a lado
        ↓
  Aprueba/Rechaza/Observa
        ↓
  Genera acta PDF (Puppeteer)
```

---

## Estructura del Proyecto

```
sis-revision-tesis/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/           # JWT Auth
│   │       │   ├── users/          # Gestión usuarios
│   │       │   ├── programs/       # Programas académicos
│   │       │   ├── templates/      # Documentos patrón
│   │       │   ├── submissions/    # Avances de tesis
│   │       │   ├── ai-analysis/    # Pipeline IA (core)
│   │       │   │   ├── processors/ # BullMQ workers
│   │       │   │   ├── prompts/    # Prompts académicos en español
│   │       │   │   └── services/   # Extractor PDF/Word
│   │       │   ├── reviews/        # Revisión humana
│   │       │   ├── reports/        # Generación PDF (Puppeteer)
│   │       │   ├── dashboard/      # KPIs y estadísticas
│   │       │   ├── notifications/  # WebSocket + DB
│   │       │   ├── storage/        # MinIO
│   │       │   └── email/          # Nodemailer
│   │       └── prisma/
│   └── web/                    # Next.js 15 Frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/         # Login, registro
│           │   └── (dashboard)/    # Panel principal
│           ├── components/
│           │   ├── layout/         # Sidebar, Header
│           │   └── ui/             # Componentes base
│           ├── lib/                # API client, utils
│           └── store/              # Zustand (auth, notifications)
└── packages/
    └── database/
        └── prisma/
            ├── schema.prisma       # Schema MySQL completo
            └── seed.ts             # Datos de prueba
```

---

## Evaluación IA: Criterios y Pesos

| Dimensión | Peso | Qué evalúa |
|-----------|------|-----------|
| Estructura | 30% | Secciones presentes, orden, jerarquía, índice |
| Contenido | 40% | Objetivos, coherencia, profundidad, metodología, citas |
| Forma | 20% | Extensión, redacción académica, formato de citas |
| Originalidad | 10% | Aporte original, pensamiento crítico, síntesis |

**Conversión a nota:** `(complianceScore / 100) * nota_maxima_programa`

**Severidades de hallazgos:**
- 🔴 **Crítico:** Detiene la aprobación. Ej: Sección obligatoria ausente, objetivos no definidos.
- 🟠 **Mayor:** Afecta significativamente la calidad. Ej: Metodología incompleta.
- 🟡 **Menor:** Mejora importante. Ej: Extensión insuficiente en una sección.
- 🔵 **Sugerencia:** Optimización opcional. Ej: Incluir más fuentes recientes.

---

## Decisiones de Arquitectura

1. **MySQL en lugar de PostgreSQL:** Se usa XAMPP según requerimiento. Los embeddings se almacenan como JSON (array de floats). Para búsqueda semántica en escala se recomienda migrar a pgvector o Weaviate.

2. **Modelos de IA configurables:** El sistema soporta OpenAI (gpt-4o, gpt-4o-mini) y Ollama (local, sin costo) via variable de entorno `AI_PROVIDER`.

3. **BullMQ desacoplado:** Los workers de IA corren independientemente del servidor HTTP, permitiendo escalar horizontalmente añadiendo más workers.

4. **Monorepo sin Turborepo:** Se usa npm workspaces directamente para simplicidad con XAMPP. Turborepo puede añadirse para builds incrementales.

---

## Mejoras Futuras (Roadmap)

- [ ] **Detección de plagio** con Turnitin API o simhash local
- [ ] **Análisis de citas** con CrossRef API (validar referencias bibliográficas)
- [ ] **Fine-tuning** del modelo con retroalimentación humana acumulada
- [ ] **Integración ORCID** para verificar identidad de autores
- [ ] **pgvector** para búsqueda semántica real (requiere migrar de MySQL a PostgreSQL)
- [ ] **Multimodal** (GPT-4o Vision): analizar figuras, tablas e imágenes en los documentos
- [ ] **Procesamiento por lotes** (bulk review) con progreso en tiempo real
- [ ] **Dashboard móvil** (React Native o PWA)
