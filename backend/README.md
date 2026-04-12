# NovaChat Backend - Python FastAPI Server

Real-time chat backend with WebSocket support for global connectivity.

## Features

- Real-time messaging via WebSockets
- User authentication (register/login)
- Friend system with friend codes
- Persistent SQLite database
- Voice/video calling support (structure ready for WebRTC)

## Installation

1. Install Python 3.8 or higher
2. Navigate to the backend directory:
```bash
cd backend
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Server

### Local Development
```bash
python server.py
```

The server will start on `http://localhost:8000`

### Production Deployment

For global connectivity, deploy this backend to a cloud service:

#### Option 1: Railway.app (Easiest)
1. Create a Railway account
2. Push this repository to GitHub
3. Connect Railway to your GitHub repository
4. Railway will automatically detect the Python app and deploy it
5. Update the frontend API_URL to your Railway URL

#### Option 2: Heroku
1. Install Heroku CLI
2. Create a `Procfile`:
```
web: uvicorn server:app --host 0.0.0.0 --port $PORT
```
3. Deploy:
```bash
heroku create novachat-backend
heroku buildpacks:set heroku/python
git push heroku main
```

#### Option 3: AWS EC2
1. Launch an EC2 instance
2. Install Python and dependencies
3. Run the server with:
```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```
4. Configure security group to allow port 8000
5. Use a reverse proxy (nginx) for SSL/HTTPS

#### Option 4: DigitalOcean
1. Create a Droplet
2. Install Python and dependencies
3. Run the server with uvicorn
4. Configure firewall to allow port 8000
5. Use nginx for SSL/HTTPS

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

### Friends
- `GET /friends/list/{user_id}` - Get user's friends
- `POST /friends/add` - Add friend by code
- `POST /friends/request` - Send friend request
- `POST /friends/accept` - Accept friend request

### Messages
- `GET /messages/{user_id}/{friend_id}` - Get conversation messages

### WebSocket
- `WS /ws/{user_id}` - Real-time WebSocket connection

## Database

The server uses SQLite for data persistence. The database file `novachat.db` is created automatically on first run.

For production, consider migrating to PostgreSQL:
1. Install `psycopg2-binary`
2. Update database connection string
3. Use SQLAlchemy for ORM

## Frontend Configuration

Update the API_URL in `src/renderer/src/ui/pages/NovaChatPage.tsx`:
```typescript
const API_URL = 'https://your-deployed-backend.com'
```

## Security Notes

For production deployment:
1. Use HTTPS (SSL/TLS)
2. Hash passwords (bcrypt/argon2)
3. Add rate limiting
4. Add input validation
5. Use environment variables for secrets
6. Add CORS restrictions
7. Add JWT token authentication

## Voice/Video Calling

The backend has the structure for WebRTC calls. For full implementation:
1. Add STUN/TURN server for NAT traversal
2. Implement WebRTC signaling in the WebSocket handler
3. Add ICE candidate exchange
4. Integrate with frontend WebRTC API

## Troubleshooting

### Server won't start
- Check if port 8000 is already in use
- Ensure all dependencies are installed

### WebSocket connection fails
- Check firewall settings
- Ensure backend is running
- Verify API_URL in frontend

### Database errors
- Delete `novachat.db` and restart server
- Check file permissions
