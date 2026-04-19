# ADR-000 — BFF + Postgres para Arch Manager

**Estado:** Aprobado
**Fecha:** 2026-04-19
**Autor:** Arquitectura de Datos

## Contexto

El primer prototipo de Arch Manager se construyó en Claude Design como un SPA puro (HTML/JS/Babel via CDN) que persistía todo en `localStorage` y autenticaba contra una lista de usuarios hardcoded en el bundle de JS. Sirvió para validar el flujo (HLD/ADR/RFC/CapReq + transición de estados Draft → In Review → Approved → Deprecated), pero no se puede mostrar como demo creíble ni mucho menos llevar a OCP por tres razones concretas:

1. **No hay persistencia compartida.** Cada navegador ve sus propios datos.
2. **Las credenciales viajan en el bundle JS** que cualquiera puede inspeccionar.
3. **No hay audit trail**, requisito no negociable de gobierno bancario.

Necesitamos una arquitectura que: (a) se demueste en Render con bajo esfuerzo, (b) use el patrón BFF estándar del banco, (c) sea trasladable a OCP sin reescribir, (d) sea trasladable a ECS más adelante (migración OCP→ECS en curso) sin reescribir el código de aplicación.

## Opciones consideradas

### Opción A — Mantener SPA + agregar Firebase/Supabase
Persistencia y auth gestionados por un BaaS externo. Velocidad máxima.

**Contras decisivos:** dato bancario sale del perímetro, no aplica para producción, no encaja con el patrón BFF del banco.

### Opción B — SPA + API Gateway + Lambdas
Serverless con Cognito o Entra ID para auth.

**Contras:** introduce dependencias AWS específicas que complican el camino a OCP. La organización del banco penaliza esto cuando hay opción on-prem equivalente.

### Opción C — SPA + BFF (Python/FastAPI) + Postgres ✅
Patrón clásico de banca: el SPA es tonto, el BFF concentra auth, RBAC y agregación, la sesión vive server-side, la cookie es HttpOnly + SameSite. Postgres como sistema de registro.

## Decisión

**Opción C.** Stack:

- **BFF:** Python 3.12 + FastAPI + SQLAlchemy 2 + Pydantic v2. Alineado con el equipo Data (Python skill ya en el equipo).
- **Sesión:** server-side, con tabla `sessions` en PG y session id firmado con `itsdangerous` viajando en cookie HttpOnly + SameSite=Lax. Cuando se enchufe Entra ID, el flow OIDC code+PKCE termina creando esta misma sesión local — ningún router ni router cambia.
- **Persistencia:** Postgres 16. JSONB para `documents.sections`, `bytea` para adjuntos en v1 (con plan de externalizar a S3 marcado en código). Tabla `audit_log` append-only desde el día 1.
- **RBAC:** matriz de permisos por rol en código (`app/rbac.py`). Roles: `arq_datos`, `plataforma`, `tech_lead`, `admin`. v1 sin ACL por documento — solo el autor edita; las transiciones críticas (aprobar/deprecar) las hace tech_lead.
- **Empaquetado:** un único contenedor (FastAPI sirve API + estáticos del SPA build de Vite). Para OCP en el futuro se puede separar en dos Deployments (Nginx para SPA + BFF) sin tocar el código.
- **Deploy demo:** Render Blueprint (web service Docker + Postgres managed, free tier).
- **Deploy productivo:** manifiestos OCP en `deploy/ocp/` (Deployment con probes, Route TLS edge, NetworkPolicies deny-by-default).

## Consecuencias

**Positivas**
- El SPA no maneja tokens. Las credenciales y la sesión nunca salen del BFF. Es el patrón que el equipo de Seguridad reconoce.
- El mismo binario corre en Render y en OCP cambiando solo env vars. No hay código condicional por entorno.
- El audit log existe desde el v1 — cualquier transición de estado y cualquier edición queda registrada con actor, timestamp y diff resumido.
- Adoptar Entra ID no requiere refactor: solo se reemplaza el router `/api/auth/*` y el resto del backend (RBAC, dependencies, routers) sigue igual.

**Negativas / trade-offs**
- Sumamos un componente operacional (Postgres) que antes no existía. Mitigado en demo por el managed de Render; en OCP usaremos el operator que ya tenga el cluster (Crunchy/Zalando) en lugar de un PG nuestro.
- Adjuntos en `bytea` no escala — ocupará espacio en el PG. Aceptable para v1 (8MB max por archivo, volumen bajo). **TODO marcado en código** para externalizar a S3 cuando supere 1GB total o el equipo lo necesite.
- Sesiones server-side necesitan Redis o sticky sessions si en el futuro escalamos a más de un nodo y queremos invalidación instantánea cross-pod. Por ahora, con replicas=2 y tabla `sessions` en PG, funciona (cada lookup es una consulta indexada).

## Revisión
Revisar en 6 meses (2026-10) o cuando alguno de estos disparadores ocurra:
- Migración OCP → ECS completada (revisar manifiestos)
- Entra ID enchufado (eliminar usuarios DB seedeados)
- Volumen de adjuntos > 1GB (externalizar a S3)
- Necesidad de ACL por documento o por dominio (actualmente fuera de scope)
