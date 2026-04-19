# Arch Manager — Plataforma de Arquitectura Data

Gobierno de decisiones técnicas y artefactos de arquitectura (HLD, ADR, RFC, Capability Request, RACI) para el equipo de Data del Banco Galicia.

> Origen: prototipo construido en Claude Design + handoff bundle. Esta versión agrega BFF en Python/FastAPI, persistencia en PostgreSQL, RBAC server-side y audit log — lista para correr en Render como demo y trasladable a OCP sin cambios de código.

## Arquitectura

```
[ Browser SPA — Vite + React ]
            │
       cookie HttpOnly (sid firmado)
            ▼
[ BFF — FastAPI ]   ← un único contenedor sirve API + estáticos del SPA
            │
            ▼
[ PostgreSQL 16 ]   ← Render Managed PG en demo · Operator (Crunchy/Zalando) en OCP
```

- Sesión **server-side** con tabla `sessions` (no JWTs en el cliente).
- **Audit log** append-only desde el día 1.
- Configuración 100% por **env vars** → mismo binario corre en Render y en OCP.
- `/healthz` y `/readyz` listos para liveness/readiness probes.
- Imagen Docker non-root con `chgrp 0` → corre con cualquier UID arbitrario que asigne la SCC `restricted-v2` de OCP.

Ver decisión completa en [`docs/adr/ADR-000-bff-arch-manager.md`](docs/adr/ADR-000-bff-arch-manager.md).

## Estructura del repo

```
arch-manager/
├── apps/
│   ├── bff/              # FastAPI (Python 3.12)
│   │   ├── app/
│   │   │   ├── routers/  # auth, docs, attachments, health
│   │   │   ├── models.py # SQLAlchemy
│   │   │   ├── rbac.py   # matriz de permisos por rol
│   │   │   ├── auth.py   # sesiones server-side firmadas
│   │   │   └── seed.py   # 9 docs + 5 usuarios iniciales
│   │   ├── alembic/      # migraciones (para producción real)
│   │   └── requirements.txt
│   └── web/              # SPA Vite + React 18
│       └── src/
│           ├── components/
│           ├── api.js    # fetch con credentials: 'include'
│           └── App.jsx
├── deploy/ocp/           # manifiestos OpenShift
├── docs/adr/             # ADR del propio Arch Manager
├── Dockerfile            # multi-stage: build SPA → runtime FastAPI
├── docker-compose.yml    # dev local
└── render.yaml           # blueprint de Render (1-click deploy)
```

## Roles y permisos (v1)

| Rol           | Puede crear | Puede editar       | Transiciones que puede hacer                |
| ------------- | :---------: | ------------------ | ------------------------------------------- |
| `arq_datos`   | ✅          | docs propios       | Draft → In Review (si es autor)             |
| `plataforma`  | ❌          | —                  | In Review → Draft (rechazo)                 |
| `tech_lead`   | ❌          | —                  | In Review → Approved · Approved → Deprecated · In Review → Draft |
| `admin`       | ✅          | cualquier doc      | cualquier transición                        |

## Quickstart local

### Opción A — todo en docker compose

```bash
docker compose up --build
# → http://localhost:8000
# Login demo: fgarcia / galicia123
```

### Opción B — iterar el frontend con Vite

```bash
# Terminal 1: Postgres
docker compose up -d db

# Terminal 2: BFF
cd apps/bff
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
ENV=development \
DATABASE_URL=postgresql+psycopg://archmanager:archmanager@localhost:5432/archmanager \
SESSION_SECRET=local-dev-secret-32-chars-minimum \
SERVE_SPA=false \
uvicorn app.main:app --reload --port 8000

# Terminal 3: SPA con HMR
cd apps/web
npm install
npm run dev          # → http://localhost:5173 (proxy a :8000)
```

## Deploy en Render

1. Pushear el repo a GitHub.
2. Render → **New** → **Blueprint** → seleccionar el repo.
3. Render lee `render.yaml` y crea:
   - Web Service Docker (`arch-manager`)
   - Postgres managed (`arch-manager-db`)
4. En el dashboard del web service, completar `SEED_DEFAULT_PASSWORD` (es `sync: false` para no commitearlo).
5. Esperar el primer build (~3–5 min). El seed corre solo la primera vez.

**Costos:** free tier de Render duerme tras 15 min de inactividad — para demo en vivo subir a Starter ($7/mes) si vas a mostrarlo en una reunión sin warm-up.

**Después de la demo:** poner `SEED_ON_STARTUP=false` para que no intente seedear de nuevo (es idempotente igual, pero evita ruido en logs).

## Deploy en OCP — runbook

> Asume cluster OCP 4.x con un Postgres operator instalado (Crunchy o Zalando). Si no lo hay, sumar un `StatefulSet` de PG o usar un PG fuera del cluster.

```bash
# 1. Crear el namespace + recursos base
oc apply -f deploy/ocp/00-namespace.yaml

# 2. Crear el Secret (NO commitear con valores reales)
oc -n arch-manager create secret generic arch-manager-secret \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 48)" \
  --from-literal=DATABASE_URL="postgresql+psycopg://USER:PASS@HOST:5432/DB" \
  --from-literal=SEED_DEFAULT_PASSWORD="$(openssl rand -base64 24)"

# 3. ConfigMap, Service, NetworkPolicies, PDB
oc apply -f deploy/ocp/02-configmap.yaml
oc apply -f deploy/ocp/04-service.yaml
oc apply -f deploy/ocp/06-networkpolicy.yaml
oc apply -f deploy/ocp/07-pdb.yaml

# 4. Build de la imagen (BuildConfig propio o pipeline Jenkins/Tekton)
#    Pushear a image-registry.openshift-image-registry.svc:5000/arch-manager/arch-manager:1.0.0

# 5. Deployment + Route
#    Editar 03-deployment.yaml para apuntar al tag de imagen real.
#    Editar 05-route.yaml para poner el host correcto.
oc apply -f deploy/ocp/03-deployment.yaml
oc apply -f deploy/ocp/05-route.yaml

# 6. Verificar probes
oc -n arch-manager get pods -w
oc -n arch-manager logs -l app.kubernetes.io/name=arch-manager --tail=50

# 7. Smoke test
oc -n arch-manager exec deploy/arch-manager -- curl -fsS http://localhost:8000/healthz
oc -n arch-manager exec deploy/arch-manager -- curl -fsS http://localhost:8000/readyz
```

### Migraciones en OCP

En v1 el BFF crea el schema con `Base.metadata.create_all()` en el `lifespan` (cómodo para Render). Para OCP productivo:

1. Generar baseline de Alembic una vez:
   ```bash
   cd apps/bff
   alembic revision --autogenerate -m "baseline"
   ```
2. Cambiar el `lifespan` para que NO llame a `create_all()`.
3. Correr `alembic upgrade head` en un Job de Kubernetes antes del rollout, o como `initContainer` del Deployment.

## Cuando se enchufe Entra ID

El equipo ya tiene experiencia con Entra ID (OIDC + JWT V2→V1 desde el setup PowerBI–Redshift). El cambio es acotado:

1. Reemplazar `apps/bff/app/routers/auth.py`:
   - `/api/auth/login` → `RedirectResponse` al endpoint `authorize` de Entra (code flow + PKCE).
   - Agregar `/api/auth/callback` que intercambia el `code` por tokens, valida el ID token (firma + audience + issuer), busca/crea el usuario en DB, y llama a `issue_session(...)`.
2. Eliminar el seed de usuarios (`SEED_ON_STARTUP=false` y borrar `SEED_USERS`).
3. Mapear el claim `roles` de Entra al campo `users.role` (decisión: claim custom o grupos AAD → tabla de mapping).
4. Sumar `SameSite=Strict` y double-submit CSRF token cuando todo el dominio sea bancario.

**Lo que NO cambia:** todos los routers de docs/attachments, RBAC, audit, dependencies, frontend. La sesión server-side es la misma abstracción.

## Cuando se externalice attachments a S3

Está marcado con `TODO[storage]` en `app/models.py` y `app/routers/attachments.py`:

1. Reemplazar `Attachment.content: bytes` por `storage_key: str`.
2. En `upload_attachment`: subir a S3 con `boto3` + bucket `arch-manager-attachments`, guardar la key.
3. En `get_attachment`: devolver una signed URL (5 min) en lugar de stream-ear desde DB.

El contrato del frontend (`AttachmentOut.url`) no cambia.

## Path a ECS

Cuando llegue la migración OCP → ECS:

- El mismo `Dockerfile` se usa para construir la imagen (push a ECR).
- El `Deployment` + `Service` + `Route` se reemplazan por:
  - **ECS Task Definition** con el container, env vars (de SSM/Secrets Manager), CPU/memoria.
  - **ALB** con TLS y health check a `/readyz`.
  - **Security Groups** equivalentes a las NetworkPolicies.
- El BFF mismo no cambia.

## Credenciales demo

Todos con password `galicia123` (configurable via `SEED_DEFAULT_PASSWORD`):

| Usuario     | Rol         | Puede                                            |
| ----------- | ----------- | ------------------------------------------------ |
| `fgarcia`   | arq_datos   | Crear y editar docs propios, mandarlos a review |
| `lmartinez` | arq_datos   | Idem                                             |
| `cruiz`     | plataforma  | Rechazar docs en review                         |
| `tlead`     | tech_lead   | Aprobar y deprecar                              |
| `admin`     | admin       | Todo                                             |

## Endpoints

| Método | Path                                       | Auth | Descripción                       |
| ------ | ------------------------------------------ | ---- | --------------------------------- |
| GET    | `/healthz`                                 | —    | Liveness                          |
| GET    | `/readyz`                                  | —    | Readiness (chequea DB)            |
| POST   | `/api/auth/login`                          | —    | Login (crea sesión)               |
| POST   | `/api/auth/logout`                         | ✅   | Cierra sesión                     |
| GET    | `/api/auth/me`                             | ✅   | Usuario actual + permisos         |
| GET    | `/api/docs`                                | ✅   | Lista de docs                     |
| GET    | `/api/docs/{id}`                           | ✅   | Doc individual + adjuntos         |
| POST   | `/api/docs`                                | ✅   | Crear doc (RBAC: `doc.create`)    |
| PUT    | `/api/docs/{id}`                           | ✅   | Editar (RBAC: autor o admin)      |
| POST   | `/api/docs/{id}/transition`                | ✅   | Cambiar estado                    |
| POST   | `/api/docs/{id}/attachments`               | ✅   | Subir adjunto (multipart, 8MB max)|
| GET    | `/api/attachments/{id}`                    | ✅   | Stream del adjunto                |
| DELETE | `/api/attachments/{id}`                    | ✅   | Eliminar adjunto                  |

OpenAPI interactiva: `/docs` (FastAPI Swagger UI, deshabilitar en prod si es necesario).

## Observabilidad

- Logs estructurados en stdout (formato default de uvicorn). Se pueden agregar a la pipeline existente del banco.
- Audit log queryable directamente desde Postgres:
  ```sql
  SELECT actor_name, action, doc_id, detail, at
  FROM audit_log
  WHERE doc_id = 'doc-005'
  ORDER BY at DESC;
  ```
- Métricas: agregar `prometheus-fastapi-instrumentator` en una segunda iteración cuando haya requerimiento concreto del equipo de Plataforma.
