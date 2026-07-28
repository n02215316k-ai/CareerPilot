# CareerPilot Domain Deployment

Target hostname:

```text
careerpilot.co.zw
```

Application container:

```text
careerpilot-cv-builder
```

Internal port:

```text
3000
```

Server directory:

```text
/srv/docker/apps/careerpilot-cv-builder
```

Nginx Proxy Manager should route the CareerPilot hostname to:

```text
Forward Hostname/IP: careerpilot-cv-builder
Forward Port: 3000
Websockets Support: enabled
Block Common Exploits: enabled
SSL: Let's Encrypt certificate for careerpilot.co.zw
Force SSL: enabled
```

The app must not publish ports in Docker Compose. It only uses `expose`.

Required server `.env` values:

```text
APP_URL=https://careerpilot.co.zw
DATABASE_URL=postgresql://careerpilot_cv_builder:<password>@postgres:5432/careerpilot_cv_builder
JWT_SECRET=<32+ character random secret>
GEMINI_API_KEY=<Gemini API key>
GEMINI_MODEL=gemini-3.6-flash
```

Deployment commands on the VPS:

```bash
cd /srv/docker/apps/careerpilot-cv-builder
docker compose up -d --build
docker ps --filter name=careerpilot-cv-builder
docker logs --tail=100 careerpilot-cv-builder
```
