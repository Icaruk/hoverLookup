## Start

```bash
podman compose up -d

# -d = detached mode
```

## Commands

```bash
# status
podman ps

# logs
podman compose logs -f mongodb

podman compose stop
podman compose restart

# delete (keeps data)
podman compose down

# delete (removes data)
podman compose down -v
```

## Access MongoDB Shell

```bash
podman exec -it hoverlookup-mongodb mongosh -u root -p root

# inside the shell:
use hoverlookup
db.lookups.find()
db.lookups.insertOne({id: "1234", status: "ok"})
```

## Connection String

```
mongodb://admin:changeme@localhost:27017/hoverlookup?authSource=admin
```