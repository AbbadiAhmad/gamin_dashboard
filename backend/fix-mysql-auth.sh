#!/bin/bash
# Fix MySQL authentication method for MariaDB client compatibility

# Wait for MySQL to be ready
sleep 5

# Get credentials from environment or use defaults
DB_USER=${DB_USER:-coaches_user}
DB_PASSWORD=${DB_PASSWORD:-coaches_pass}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-rootpassword}

# Determine which container we're in
if [ -z "$MYSQL_USER" ]; then
    # We're in the backend container, need to connect to MySQL container
    MYSQL_HOST=${DB_HOST:-mysql}
    echo "Fixing MySQL authentication for user: $DB_USER"

    mysql -h "$MYSQL_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
        ALTER USER '$DB_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';
        FLUSH PRIVILEGES;
EOSQL

    if [ $? -eq 0 ]; then
        echo "✓ MySQL authentication fixed successfully"
    else
        echo "⚠ Could not fix MySQL authentication (user might already be configured)"
    fi
fi
