"""Smoke test E2E v2 — corre contra SQLite en memoria."""
import os
import sys
import logging

sys.path.insert(0, '.')
logging.disable(logging.CRITICAL)

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SESSION_SECRET'] = 'test-secret-for-smoke-test-32-chars-min'
os.environ['SERVE_SPA'] = 'false'
os.environ['AUTO_MIGRATE'] = 'false'

import sqlalchemy
from sqlalchemy.pool import StaticPool

_orig = sqlalchemy.create_engine
def _patched(url, **kw):
    if str(url).startswith('sqlite'):
        kw.pop('pool_size', None); kw.pop('max_overflow', None)
        kw['poolclass'] = StaticPool
        kw.setdefault('connect_args', {'check_same_thread': False})
    return _orig(url, **kw)
sqlalchemy.create_engine = _patched

from sqlalchemy.dialects.postgresql.json import JSONB
from sqlalchemy.ext.compiler import compiles
@compiles(JSONB, 'sqlite')
def _x(element, compiler, **kw): return 'JSON'

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
Base.metadata.create_all(bind=engine)

from app.seed import run_seed
with SessionLocal() as db:
    run_seed(db)

c = TestClient(app)

print('═' * 64)
print(' SMOKE TEST v2 — Arch Manager BFF')
print('═' * 64)

passed = failed = 0
def t(name, fn):
    global passed, failed
    try:
        fn()
        print(f'  [PASS] {name}'); passed += 1
    except AssertionError as e:
        print(f'  [FAIL] {name}: {e}'); failed += 1
    except Exception as e:
        print(f'  [ERR ] {name}: {type(e).__name__}: {e}'); failed += 1

# ─── Auth & health ─────────────────────────────────────────────────────
def t1():
    assert c.get('/healthz').status_code == 200
    assert c.get('/readyz').status_code == 200
t('health + readyz', t1)

def t2():
    assert c.post('/api/auth/login', json={'user':'bad','pass':'x'}).status_code == 401
t('login inválido → 401', t2)

def t3():
    r = c.post('/api/auth/login', json={'user':'fgarcia','pass':'galicia123'})
    assert r.status_code == 200 and r.json()['role'] == 'arq_datos'
    assert r.json()['must_change_password'] is False
t('login arq_datos (fgarcia)', t3)

def t4():
    assert c.get('/api/docs').status_code == 200
    assert len(c.get('/api/docs').json()) == 9
t('list docs: 9 del seed', t4)

# ─── RBAC nuevo: arq_datos crea, arq_lead aprueba ──────────────────────
new_id = [None]
def t5():
    r = c.post('/api/docs', json={'type':'adr','title':'ADR-test','domain':'Test'})
    assert r.status_code == 201
    new_id[0] = r.json()['id']
t('arq_datos crea doc', t5)

def t6():
    # Draft → In Review (autor)
    r = c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'In Review'})
    assert r.status_code == 200
t('autor: Draft → In Review', t6)

def t7():
    # arq_datos NO puede aprobar
    r = c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'Approved'})
    assert r.status_code == 403
t('arq_datos: In Review → Approved → 403', t7)

def t8():
    # tech_lead ya NO aprueba (cambió el modelo)
    c.post('/api/auth/logout')
    r = c.post('/api/auth/login', json={'user':'tlead','pass':'galicia123'})
    assert r.status_code == 200 and r.json()['role'] == 'tech_lead'
    r = c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'Approved'})
    assert r.status_code == 403, f'tech_lead no debe aprobar, got {r.status_code}'
t('tech_lead: In Review → Approved → 403 (ahora es arq_lead)', t8)

def t9():
    # tech_lead SÍ puede rechazar
    r = c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'Draft'})
    assert r.status_code == 200 and r.json()['status'] == 'Draft'
t('tech_lead: In Review → Draft (rechazo)', t9)

def t10():
    # Volver a In Review como autor
    c.post('/api/auth/logout')
    c.post('/api/auth/login', json={'user':'fgarcia','pass':'galicia123'})
    c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'In Review'})
    # arq_lead SÍ aprueba
    c.post('/api/auth/logout')
    r = c.post('/api/auth/login', json={'user':'alead','pass':'galicia123'})
    assert r.status_code == 200 and r.json()['role'] == 'arq_lead'
    r = c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'Approved'})
    assert r.status_code == 200 and r.json()['status'] == 'Approved'
t('arq_lead: In Review → Approved', t10)

def t11():
    r = c.post(f'/api/docs/{new_id[0]}/transition', json={'to':'Deprecated'})
    assert r.status_code == 200 and r.json()['status'] == 'Deprecated'
t('arq_lead: Approved → Deprecated', t11)

def t12():
    # dm solo lee
    c.post('/api/auth/logout')
    r = c.post('/api/auth/login', json={'user':'dmanager','pass':'galicia123'})
    assert r.status_code == 200 and r.json()['role'] == 'dm'
    assert c.get('/api/docs').status_code == 200  # puede leer
    r = c.post('/api/docs', json={'type':'adr','title':'x'})
    assert r.status_code == 403  # no crea
t('dm: solo lectura', t12)

# ─── Admin: gestión de usuarios ───────────────────────────────────────
def t13():
    c.post('/api/auth/logout')
    # arq_datos NO puede listar usuarios
    c.post('/api/auth/login', json={'user':'fgarcia','pass':'galicia123'})
    assert c.get('/api/users').status_code == 403
t('arq_datos: GET /users → 403', t13)

new_user_id = [None]
new_user_temp_pw = [None]
def t14():
    c.post('/api/auth/logout')
    r = c.post('/api/auth/login', json={'user':'admin','pass':'galicia123'})
    assert r.status_code == 200 and r.json()['role'] == 'admin'
    # Admin lista usuarios
    users = c.get('/api/users').json()
    assert len(users) == 6, f'esperado 6 usuarios del seed, got {len(users)}'
t('admin: lista usuarios', t14)

def t15():
    # Admin crea usuario nuevo (sin password → backend genera)
    r = c.post('/api/users', json={
        'username':'nuevo.user', 'full_name':'Usuario Nuevo', 'role':'arq_datos',
    })
    assert r.status_code == 201, f'got {r.status_code}: {r.text}'
    body = r.json()
    assert body['must_change_password'] is True
    assert 'temporary_password' in body
    assert len(body['temporary_password']) >= 10
    new_user_id[0] = body['id']
    new_user_temp_pw[0] = body['temporary_password']
t('admin crea usuario con temp password', t15)

def t16():
    # Username duplicado → 409
    r = c.post('/api/users', json={
        'username':'nuevo.user', 'full_name':'Dup', 'role':'dm',
    })
    assert r.status_code == 409
t('username duplicado → 409', t16)

# ─── Force-change-password flow ────────────────────────────────────────
def t17():
    c.post('/api/auth/logout')
    # Login con temp password → 200 pero must_change_password=true
    r = c.post('/api/auth/login', json={'user':'nuevo.user','pass':new_user_temp_pw[0]})
    assert r.status_code == 200
    assert r.json()['must_change_password'] is True
t('login con temp pw: must_change_password=true', t17)

def t18():
    # Cualquier otra API devuelve 423 (Locked)
    r = c.get('/api/docs')
    assert r.status_code == 423, f'esperado 423, got {r.status_code}'
t('usuario con temp pw: APIs devuelven 423', t18)

def t19():
    # /api/auth/me DEBE funcionar para que el frontend sepa el estado
    r = c.get('/api/auth/me')
    assert r.status_code == 200
    assert r.json()['must_change_password'] is True
t('me: funciona aún con must_change_password=true', t19)

def t20():
    # No puedo reusar la misma password
    r = c.post('/api/auth/change-password', json={
        'current_password': new_user_temp_pw[0],
        'new_password': new_user_temp_pw[0],
    })
    assert r.status_code == 400
t('change-password: rechaza misma password → 400', t20)

def t21():
    # Password muy corta
    r = c.post('/api/auth/change-password', json={
        'current_password': new_user_temp_pw[0],
        'new_password': 'short',
    })
    assert r.status_code == 422
t('change-password: rechaza password <10 chars → 422', t21)

def t22():
    # Current password incorrecta
    r = c.post('/api/auth/change-password', json={
        'current_password': 'wrong_password_here',
        'new_password': 'NewPassword2026!',
    })
    assert r.status_code == 401
t('change-password: current incorrecto → 401', t22)

def t23():
    # Cambio exitoso
    r = c.post('/api/auth/change-password', json={
        'current_password': new_user_temp_pw[0],
        'new_password': 'NuevoPass2026Segura',
    })
    assert r.status_code == 200
    assert r.json()['must_change_password'] is False
t('change-password: exitoso limpia el flag', t23)

def t24():
    # Ahora SÍ puede acceder normalmente
    assert c.get('/api/docs').status_code == 200
t('después del cambio: APIs funcionan', t24)

# ─── Admin reset password ─────────────────────────────────────────────
def t25():
    c.post('/api/auth/logout')
    c.post('/api/auth/login', json={'user':'admin','pass':'galicia123'})
    r = c.post(f'/api/users/{new_user_id[0]}/reset-password')
    assert r.status_code == 200
    assert 'temporary_password' in r.json()
t('admin reset-password devuelve nueva temp', t25)

def t26():
    # Admin cambia rol
    r = c.patch(f'/api/users/{new_user_id[0]}', json={'role':'arq_lead'})
    assert r.status_code == 200
    assert r.json()['role'] == 'arq_lead'
t('admin cambia rol de usuario', t26)

def t27():
    # Admin no puede auto-desactivarse
    admin_id = c.get('/api/auth/me').json()['id']
    r = c.patch(f'/api/users/{admin_id}', json={'active': False})
    assert r.status_code == 400
t('admin no puede auto-desactivarse → 400', t27)

def t28():
    # Admin no puede cambiar su propio rol
    admin_id = c.get('/api/auth/me').json()['id']
    r = c.patch(f'/api/users/{admin_id}', json={'role':'arq_datos'})
    assert r.status_code == 400
t('admin no puede cambiar propio rol → 400', t28)

def t29():
    # Desactivar usuario
    r = c.delete(f'/api/users/{new_user_id[0]}')
    assert r.status_code == 204
    r = c.get(f'/api/users/{new_user_id[0]}')
    assert r.json()['active'] is False
t('admin desactiva usuario (soft)', t29)

# ─── Soft delete de docs ──────────────────────────────────────────────
def t30():
    # Admin borra doc (soft)
    r = c.delete(f'/api/docs/{new_id[0]}')
    assert r.status_code == 204
t('admin: DELETE /docs/{id} → 204', t30)

def t31():
    # List ya no lo ve
    r = c.get('/api/docs')
    ids = [d['id'] for d in r.json()]
    assert new_id[0] not in ids
t('list default excluye soft-deleted', t31)

def t32():
    # Admin ve papelera
    r = c.get('/api/docs?only_deleted=true')
    ids = [d['id'] for d in r.json()]
    assert new_id[0] in ids
t('admin: ?only_deleted=true muestra papelera', t32)

def t33():
    # Get individual: admin sí ve; otros no
    r = c.get(f'/api/docs/{new_id[0]}')
    assert r.status_code == 200
    assert r.json()['deleted_at'] is not None
t('admin ve doc soft-deleted individual', t33)

def t34():
    # No-admin no puede ver soft-deleted
    c.post('/api/auth/logout')
    c.post('/api/auth/login', json={'user':'fgarcia','pass':'galicia123'})
    r = c.get(f'/api/docs/{new_id[0]}')
    assert r.status_code == 404
t('no-admin: soft-deleted → 404', t34)

def t35():
    # Y no puede pedir la papelera
    r = c.get('/api/docs?only_deleted=true')
    assert r.status_code == 403
t('no-admin: ?only_deleted=true → 403', t35)

def t36():
    # No-admin no puede borrar
    r = c.delete('/api/docs/doc-001')
    assert r.status_code == 403
t('no-admin: DELETE → 403', t36)

def t37():
    # Admin restaura
    c.post('/api/auth/logout')
    c.post('/api/auth/login', json={'user':'admin','pass':'galicia123'})
    r = c.post(f'/api/docs/{new_id[0]}/restore')
    assert r.status_code == 200
    assert r.json()['deleted_at'] is None
t('admin restaura doc', t37)

def t38():
    # Vuelve a aparecer en list
    r = c.get('/api/docs')
    ids = [d['id'] for d in r.json()]
    assert new_id[0] in ids
t('doc restaurado vuelve a la list', t38)

# ─── Audit log consultable ────────────────────────────────────────────
def t39():
    r = c.get('/api/audit?limit=10')
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) > 0
    actions = {e['action'] for e in entries}
    assert any('user.' in a or 'doc.' in a or 'auth.' in a for a in actions)
t('admin: GET /api/audit', t39)

def t40():
    # Filtro por action
    r = c.get('/api/audit?action=user.&limit=10')
    assert r.status_code == 200
    entries = r.json()
    assert all(e['action'].startswith('user.') for e in entries)
t('audit: filtro por action=user.', t40)

def t41():
    # No-admin no ve el audit
    c.post('/api/auth/logout')
    c.post('/api/auth/login', json={'user':'fgarcia','pass':'galicia123'})
    r = c.get('/api/audit')
    assert r.status_code == 403
t('no-admin: GET /audit → 403', t41)

print()
print('═' * 64)
if failed == 0:
    print(f' ✅ {passed}/{passed+failed} TESTS PASARON')
else:
    print(f' ❌ {failed} fallaron · {passed} pasaron')
print('═' * 64)
sys.exit(0 if failed == 0 else 1)
