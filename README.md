# MineTwin 3D — Gemelos Digitales para Equipos de Carguío Minero (CBM)

Plataforma integral de **Gemelos Digitales (Digital Twins) 3D** y **Mantenimiento Predictivo Basado en Condición (CBM)** para palas hidráulicas, palas de cable, cargadores frontales y excavadoras en minería a cielo abierto.

---

## 🏗️ Arquitectura de la Solución

- **Visualización 3D:** Three.js / WebGL con shaders semánticos de salud PBR (Verde/Amarillo/Naranja/Rojo) y jerarquía de componentes.
- **Analítica de IA:** Isolation Forest multivariante, regresión RUL con XGBoost e intervalos de confianza, clasificación ISO 14224 y simulador What-If.
- **Backend:** Python 3.11+ / FastAPI con WebSockets a 10 Hz, SQLAlchemy 2.0 y RBAC granular.
- **Base de Datos:** PostgreSQL 15 + TimescaleDB particionado para series temporales de sensores.
- **Reportabilidad:** Exportador corporativo en PDF, Word (.docx) y Excel (.xlsx).

---

## 🚀 Despliegue con Docker Compose

```bash
# 1. Clonar repositorio y entrar a la carpeta
git clone https://github.com/minetwin/digital-twin-mining.git
cd digital-twin-mining

# 2. Iniciar todos los servicios (PostgreSQL/TimescaleDB, Redis, MQTT, FastAPI y Frontend)
docker-compose up -d --build

# 3. Acceder a la plataforma
# Frontend Web: http://localhost:3000
# Documentación API Swagger: http://localhost:8000/docs
```

---

## 🔑 Credenciales Demo y Roles RBAC

| Rol | Correo Electrónico | Contraseña Demo |
|---|---|---|
| **Jefe de Mantenimiento** | `carlos.mendoza@mina-austral.com` | `MiningCBM2026!` |
| **Ingeniera de Confiabilidad** | `valeria.rojas@mina-austral.com` | `MiningCBM2026!` |
| **Administrador del Sistema** | `admin.minetwin@mina-austral.com` | `MiningCBM2026!` |
| **Planificador de Mantenimiento**| `fernando.perez@mina-austral.com` | `MiningCBM2026!` |
| **Supervisor de Turno** | `roberto.gomez@mina-austral.com` | `MiningCBM2026!` |
| **Técnico Especialista** | `diego.alarcon@mina-austral.com` | `MiningCBM2026!` |
| **Visualizador Operaciones** | `gerencia.operaciones@mina-austral.com` | `MiningCBM2026!` |
