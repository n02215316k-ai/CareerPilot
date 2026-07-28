# CareerPilot Domain Deployment

Target hostname:

```text
careerpilot.co.zw
```

Application container when replacing the existing CareerPilot site:

```text
careerpilot
```

Internal port:

```text
80
```

Server directory:

```text
/srv/docker/websites/careerpilot
```

The server already has `careerpilot.co.zw` routed to a container named `careerpilot`.
To reuse that proxy host without Nginx Proxy Manager changes, deploy with:

```text
deploy/docker-compose.careerpilot-domain.yml
```

That compose file runs the Next.js app as container `careerpilot` on internal port `80`.

If creating a separate proxy host instead, route the CareerPilot hostname to:

```text
Forward Hostname/IP: careerpilot
Forward Port: 80
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
cd /srv/docker/websites/careerpilot
cp deploy/docker-compose.careerpilot-domain.yml docker-compose.yml
docker compose up -d --build
docker ps --filter name=careerpilot
docker logs --tail=100 careerpilot
```
