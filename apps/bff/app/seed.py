"""
Seed inicial v2 — usuarios con 5 roles nuevos + 9 docs del mock.
Idempotente: solo inserta si no hay datos.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import get_settings
from app.models import Document, User

settings = get_settings()

# Usuarios iniciales — todos con la misma password del seed, must_change_password=False
# (para demo). En producción real, admin debe tener must_change_password=True tras
# el primer login.
SEED_USERS = [
    # username, full_name, role
    ("fgarcia",   "Fernando García",   "arq_datos"),
    ("lmartinez", "Lucía Martínez",    "arq_datos"),
    ("alead",     "Ana Arq-Lead",      "arq_lead"),
    ("tlead",     "Tomás Tech-Lead",   "tech_lead"),
    ("dmanager",  "Diego Manager",     "dm"),
    ("admin",     "Admin",             "admin"),
]

SEED_DOCS = [
    {
        "id": "doc-001", "type": "hld", "status": "Approved",
        "title": "HLD — Arquitectura Medallion (Bronze / Silver / Gold)",
        "author": "fgarcia", "domain": "Data Platform",
        "sections": {
            "context": "Diseño de arquitectura lakehouse bancaria con capas Bronze, Silver y Gold sobre S3. Contexto regulatorio BCRA — datos de clientes con clasificación confidencial.",
            "nfrs": "SLA: 99.9%\nThroughput: 50.000 eventos/seg pico\nRPO: 4h / RTO: 2h\nLatencia capa Gold: <200ms p95\nCompliance: SOX, BCRA A6938",
            "raci_ref": "Bronze: R=Data Eng, A=Arq Datos, C=Plataforma\nSilver: R=Data Eng, A=Arq Datos, C=Plataforma\nGold: R=Data Eng, A=Tech Lead, C=Arq Datos",
        },
    },
    {
        "id": "doc-002", "type": "adr", "status": "Approved",
        "title": "ADR-001 — Apache Iceberg como formato en Bronze/Silver",
        "author": "fgarcia", "domain": "Storage",
        "sections": {
            "context": "Necesitamos un formato de tabla open-source con soporte ACID para el lakehouse.",
            "options": "Opción A: Apache Iceberg\nOpción B: Delta Lake\nOpción C: Apache Hudi",
            "decision": "Apache Iceberg — mayor compatibilidad con ecosistema open-source (Spark, Flink, Trino, DuckDB).",
            "consequences": "Requiere Iceberg REST Catalog. Dependencia de AWS Glue Data Catalog para metadata.",
        },
    },
    {
        "id": "doc-003", "type": "adr", "status": "Approved",
        "title": "ADR-002 — OBT en Platinum para serving",
        "author": "lmartinez", "domain": "Storage",
        "sections": {
            "context": "La capa de serving (Platinum) necesita latencia <10ms.",
            "decision": "One Big Table (OBT) desnormalizado en Platinum.",
            "consequences": "Incremento estimado de 30% en storage. Pipeline de materialización requerido.",
        },
    },
    {
        "id": "doc-004", "type": "adr", "status": "Approved",
        "title": "ADR-003 — MongoDB en Local Zone Buenos Aires por latencia <10ms",
        "author": "fgarcia", "domain": "Serving",
        "sections": {},
    },
    {
        "id": "doc-005", "type": "rfc", "status": "In Review",
        "title": "RFC-001 — Orquestación: MWAA vs Prefect vs Dagster",
        "author": "fgarcia", "domain": "Orchestration",
        "sections": {
            "problem": "Necesitamos una plataforma de orquestación para los pipelines de datos.",
            "proposal": "MWAA (Managed Airflow) como opción principal.",
            "alternatives": "Prefect Cloud, Dagster.",
            "open_questions": "1. ¿Plataforma puede operar MWAA?\n2. ¿Modelo de costos escala?",
            "stakeholders": "Arquitectura de Datos: Fernando García\nPlataforma: Carlos Ruiz",
        },
    },
    {
        "id": "doc-006", "type": "rfc", "status": "Draft",
        "title": "RFC-002 — Secrets Management: Vault vs SSM Parameter Store",
        "author": "fgarcia", "domain": "Security",
        "sections": {},
    },
    {
        "id": "doc-007", "type": "capability", "status": "Draft",
        "title": "CapReq-001 — Cluster EMR Serverless para procesamiento Silver",
        "author": "lmartinez", "domain": "Infrastructure",
        "sections": {
            "service": "EMR Serverless cluster: 200 vCPU máximo, 800GB RAM, acceso a S3 Bronze y Silver.",
            "hld_ref": "HLD — Arquitectura Medallion (doc-001)",
            "slas": "Disponibilidad: 99.5%\nLatencia de start: <2min\nThroughput: 50GB/h",
        },
    },
    {
        "id": "doc-008", "type": "hld", "status": "In Review",
        "title": "HLD — Ingesta en tiempo real (Kinesis + dlt)",
        "author": "lmartinez", "domain": "Ingestion",
        "sections": {
            "context": "Diseño para ingesta de eventos en tiempo real.",
        },
    },
    {
        "id": "doc-009", "type": "raci", "status": "Approved",
        "title": "RACI — Data Platform v1.2",
        "author": "fgarcia", "domain": "Governance",
        "sections": {
            "scope": "RACI para la plataforma de datos del banco.",
            "layers": "Bronze Layer (Raw): R = Data Eng, A = Arq Datos, C = Plataforma\nSilver: R = Data Eng, A = Arq Datos\nGold: R = Data Eng, A = Tech Lead\nPlatinum: R = Data Eng, A = Tech Lead",
        },
    },
]


def run_seed(db: Session) -> None:
    if db.query(User).count() > 0:
        return  # ya seedeado

    pw_hash = hash_password(settings.seed_default_password)
    users_by_username: dict[str, User] = {}

    for username, name, role in SEED_USERS:
        u = User(
            username=username,
            full_name=name,
            role=role,
            password_hash=pw_hash,
            must_change_password=False,  # demo — no forzamos cambio en el seed
        )
        db.add(u)
        users_by_username[username] = u
    db.flush()

    now = datetime.now(timezone.utc)
    for d in SEED_DOCS:
        author = users_by_username[d["author"]]
        db.add(Document(
            id=d["id"],
            type=d["type"],
            status=d["status"],
            title=d["title"],
            domain=d.get("domain", ""),
            author_id=author.id,
            author_name=author.full_name,
            sections=d.get("sections", {}),
            created_at=now,
            updated_at=now,
        ))

    db.commit()
