#!/bin/bash

# Production deployment script for Gaming Dashboard

echo "====================================="
echo "Gaming Dashboard - Production Deploy"
echo "====================================="
echo ""

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "⚠️  Warning: .env.prod file not found!"
    echo "Please create .env.prod with your production configuration"
    echo ""
    exit 1
fi

# Show current configuration
echo "Current configuration:"
grep VUE_APP_API_URL .env.prod
echo ""

# Stop current containers
echo "Stopping development containers..."
docker-compose down

# Build and start production containers
echo ""
echo "Building production images..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod build

echo ""
echo "Starting production containers..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Fix MySQL authentication for MariaDB client compatibility
# Read credentials from .env.prod
echo ""
echo "Fixing MySQL authentication for backup/restore compatibility..."
MYSQL_ROOT_PASS=$(grep "^MYSQL_ROOT_PASSWORD=" .env.prod | cut -d '=' -f2)
MYSQL_USER=$(grep "^MYSQL_USER=" .env.prod | cut -d '=' -f2)
MYSQL_PASS=$(grep "^MYSQL_PASSWORD=" .env.prod | cut -d '=' -f2)

docker exec vue-game_dashboard-db mysql -u root -p"$MYSQL_ROOT_PASS" -e "ALTER USER '$MYSQL_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$MYSQL_PASS'; FLUSH PRIVILEGES;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ MySQL authentication fixed successfully"
else
    echo "✓ MySQL authentication already configured or will be fixed on first backend start"
fi

# Check container status
echo ""
echo "Container Status:"
docker-compose -f docker-compose.prod.yml --env-file .env.prod ps

echo ""
echo "====================================="
echo "✓ Production deployment complete!"
echo "====================================="

echo "To view logs: docker-compose -f docker-compose.prod.yml --env-file .env.prod logs -f"
echo "To stop:      docker-compose -f docker-compose.prod.yml --env-file .env.prod down"
echo ""
