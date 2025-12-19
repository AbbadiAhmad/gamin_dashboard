@echo off
echo =====================================
echo Gaming Dashboard - Production Deploy
echo =====================================
echo.

REM Check if .env.prod exists
if not exist .env.prod (
    echo WARNING: .env.prod file not found!
    echo Please create .env.prod with your production configuration
    echo.
    pause
    exit /b 1
)

REM Show current configuration
echo Current configuration:
findstr VUE_APP_API_URL .env.prod
echo.

REM Stop current containers
echo Stopping development containers...
docker-compose down

REM Build and start production containers
echo.
echo Building production images...
docker-compose -f docker-compose.prod.yml --env-file .env.prod build

echo.
echo Starting production containers...
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo.
echo Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

REM Fix MySQL authentication for MariaDB client compatibility
REM Read credentials from .env.prod
echo.
echo Fixing MySQL authentication for backup/restore compatibility...
for /f "tokens=2 delims==" %%a in ('findstr "^MYSQL_ROOT_PASSWORD=" .env.prod') do set MYSQL_ROOT_PASS=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^MYSQL_USER=" .env.prod') do set MYSQL_USER=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^MYSQL_PASSWORD=" .env.prod') do set MYSQL_PASS=%%a

docker exec vue-game_dashboard-db mysql -u root -p%MYSQL_ROOT_PASS% -e "ALTER USER '%MYSQL_USER%'@'%%' IDENTIFIED WITH mysql_native_password BY '%MYSQL_PASS%'; FLUSH PRIVILEGES;" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo MySQL authentication fixed successfully
) else (
    echo MySQL authentication already configured or will be fixed on first backend start
)

REM Check container status
echo.
echo Container Status:
docker-compose -f docker-compose.prod.yml --env-file .env.prod ps

echo.
echo =====================================
echo Production deployment complete!
echo =====================================
echo.
echo Frontend: http://38.242.217.231:8081
echo Backend:  http://38.242.217.231:3000
echo.
echo To view logs: docker-compose -f docker-compose.prod.yml logs -f
echo To stop:      docker-compose -f docker-compose.prod.yml down
echo.
pause
