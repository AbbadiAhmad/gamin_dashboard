# Vue Coaches App with MySQL Backend

This application has been migrated from Firebase to MySQL. It uses Docker to run a MySQL database and a Node.js Express backend API.

## Architecture

- **Frontend**: Vue.js 3 application
- **Backend**: Node.js Express REST API
- **Database**: MySQL 8.0 running in Docker
- **Containerization**: Docker Compose for orchestration

## Database Schema

### Tables

1. **coaches**
   - `id` (VARCHAR, PRIMARY KEY) - User ID
   - `first_name` (VARCHAR)
   - `last_name` (VARCHAR)
   - `description` (TEXT)
   - `hourly_rate` (DECIMAL)
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

2. **coach_areas**
   - `id` (INT, AUTO_INCREMENT, PRIMARY KEY)
   - `coach_id` (VARCHAR, FOREIGN KEY)
   - `area` (VARCHAR) - e.g., 'frontend', 'backend', 'career'

3. **requests**
   - `id` (INT, AUTO_INCREMENT, PRIMARY KEY)
   - `coach_id` (VARCHAR, FOREIGN KEY)
   - `user_email` (VARCHAR)
   - `message` (TEXT)
   - `created_at` (TIMESTAMP)

## Prerequisites

- Docker Desktop installed and running
- Node.js (for frontend development)
- npm or yarn

## Setup Instructions

### 1. Start the Backend and Database

From the project root directory:

```bash
# Start MySQL and Backend API using Docker Compose
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f
```

This will:
- Start MySQL on port 3306
- Initialize the database with the schema from `backend/init.sql`
- Start the Express backend API on port 3000

### 2. Verify Backend is Running

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok","message":"Database connected"}
```

### 3. Install Frontend Dependencies

```bash
npm install
```

### 4. Start the Vue.js Frontend

```bash
npm run serve
```

The application should now be running at `http://localhost:8080`

## API Endpoints

### Coaches

- `GET /coaches` - Get all coaches
- `GET /coaches/:id` - Get a specific coach
- `PUT /coaches/:id` - Register or update a coach

### Requests

- `GET /requests/:coachId` - Get all requests for a coach
- `POST /requests/:coachId` - Send a contact request to a coach

## Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v

# View logs
docker-compose logs -f backend
docker-compose logs -f mysql

# Restart a service
docker-compose restart backend

# Rebuild backend after code changes
docker-compose up -d --build backend
```

## Database Access

To access the MySQL database directly:

```bash
# Using Docker
docker exec -it vue-coaches-db mysql -u coaches_user -p
# Password: coaches_pass

# Or using MySQL client
mysql -h localhost -P 3306 -u coaches_user -p coaches_db
```

## Development

### Backend Development

The backend code is in the `backend/` directory. If you make changes:

```bash
# Rebuild and restart backend
docker-compose up -d --build backend
```

For local development without Docker:

```bash
cd backend
npm install
npm start
```

Make sure to set environment variables or create a `.env` file based on `.env.example`.

### Frontend Development

The Vue.js frontend connects to the backend at `http://localhost:3000`.

All API calls have been updated in:
- `src/store/modules/coaches/actions.js`
- `src/store/modules/requests/actions.js`

## Troubleshooting

### Backend can't connect to MySQL

```bash
# Check if MySQL is ready
docker-compose logs mysql

# Wait for: "MySQL init process done. Ready for start up."
```

### Port conflicts

If ports 3000 or 3306 are already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Change host port
```

### Reset database

```bash
# Stop and remove all data
docker-compose down -v

# Start fresh
docker-compose up -d
```

### View backend errors

```bash
docker-compose logs -f backend
```

## Migration Notes

### Changes from Firebase

1. **API URLs**: Changed from Firebase Realtime Database to local Express API
2. **Response Format**: MySQL backend returns arrays directly instead of Firebase's object format
3. **ID Generation**: Requests now use auto-increment IDs instead of Firebase's random keys
4. **Headers**: Added `Content-Type: application/json` headers to all POST/PUT requests

### Data Compatibility

The MySQL schema preserves the same data structure as Firebase:
- Coaches have the same fields (firstName, lastName, description, hourlyRate, areas)
- Requests maintain the same relationship (coachId, userEmail, message)
- Areas are normalized into a separate table for better data integrity

## Production Considerations

For production deployment:

1. Change default passwords in `docker-compose.yml`
2. Use environment variables for sensitive data
3. Enable HTTPS/SSL for API calls
4. Add authentication middleware
5. Implement rate limiting
6. Set up database backups
7. Use a production-grade MySQL configuration
8. Consider using a reverse proxy (nginx)

## License

Same as original project.
