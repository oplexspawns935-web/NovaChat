from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Set
import json
import uuid
from datetime import datetime
import asyncio
import sqlite3
from contextlib import contextmanager
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite database setup
DATABASE_URL = "novachat.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable WAL mode for better concurrency
    cursor.execute('PRAGMA journal_mode=WAL')
    cursor.execute('PRAGMA synchronous=NORMAL')
    cursor.execute('PRAGMA busy_timeout=5000')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            friend_code TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'offline',
            email_verified BOOLEAN DEFAULT 0,
            verification_token TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS friends (
            user_id TEXT NOT NULL,
            friend_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (user_id, friend_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (friend_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender_id TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            type TEXT DEFAULT 'text',
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (recipient_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS friend_requests (
            id TEXT PRIMARY KEY,
            from_user_id TEXT NOT NULL,
            to_user_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

active_connections: Dict[str, WebSocket] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
        # Update user status to online
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET status = 'online' WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # Update user status to offline
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET status = 'offline' WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

    def generate_friend_code(self) -> str:
        return uuid.uuid4().hex[:8].upper()

manager = ConnectionManager()

# Email configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@novachat.com')

def send_verification_email(email: str, username: str, token: str):
    """Send verification email to user"""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"Email credentials not configured. Would send verification email to {email} with token {token}")
        return False
    
    try:
        verification_url = f"{os.environ.get('APP_URL', 'http://localhost:8000')}/verify/{token}"
        
        msg = MIMEMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = email
        msg['Subject'] = 'Verify your NovaChat account'
        
        body = f"""
        Hi {username},
        
        Please verify your NovaChat account by clicking the link below:
        {verification_url}
        
        If you didn't create this account, you can ignore this email.
        
        Thanks,
        The NovaChat Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"Verification email sent to {email}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

@app.get("/")
async def root():
    return {"message": "NovaChat Server - Real-time Chat Backend"}

@app.post("/auth/register")
async def register(username: str = None, email: str = None, password: str = None):
    if not username or not password or not email:
        raise HTTPException(status_code=400, detail="Username, email, and password required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        user_id = str(uuid.uuid4())
        friend_code = manager.generate_friend_code()
        verification_token = str(uuid.uuid4())
        
        cursor.execute(
            "INSERT INTO users (id, username, email, password, friend_code, status, email_verified, verification_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, username, email, password, friend_code, 'offline', 0, verification_token, datetime.now().isoformat())
        )
        conn.commit()
        
        # Send verification email
        send_verification_email(email, username, verification_token)
        
        return {"user_id": user_id, "friend_code": friend_code, "username": username, "email_verified": False}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    finally:
        conn.close()

@app.post("/auth/login")
async def login(username: str = None, password: str = None):
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()
    
    if user:
        cursor.execute("UPDATE users SET status = 'online' WHERE id = ?", (user['id'],))
        conn.commit()
        conn.close()
        
        return {
            "user_id": user['id'],
            "username": user['username'],
            "friend_code": user['friend_code']
        }
    
    conn.close()
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/verify/{token}")
async def verify_email(token: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username FROM users WHERE verification_token = ?", (token,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Invalid verification token")
    
    try:
        cursor.execute("UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?", (user['id'],))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Email verified successfully"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail="Failed to verify email")

@app.get("/friends/list/{user_id}")
async def get_friends(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT u.id, u.username, u.status, u.friend_code
        FROM friends f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
    ''', (user_id,))
    
    friend_list = []
    for row in cursor.fetchall():
        friend_list.append({
            "id": row['id'],
            "username": row['username'],
            "status": row['status'],
            "friend_code": row['friend_code']
        })
    
    conn.close()
    return {"friends": friend_list}

@app.post("/friends/add")
async def add_friend(user_id: str = None, friend_code: str = None):
    if not user_id or not friend_code:
        raise HTTPException(status_code=400, detail="user_id and friend_code required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Find user by friend code
    cursor.execute("SELECT id FROM users WHERE friend_code = ?", (friend_code.upper(),))
    target_user = cursor.fetchone()
    
    if not target_user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user_id = target_user['id']
    
    if target_user_id == user_id:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    
    try:
        cursor.execute(
            "INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)",
            (user_id, target_user_id, datetime.now().isoformat())
        )
        cursor.execute(
            "INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)",
            (target_user_id, user_id, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        return {"success": True, "friend_id": target_user_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Already friends")

@app.post("/friends/request")
async def send_friend_request(from_user_id: str, to_username: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE username = ?", (to_username,))
    target_user = cursor.fetchone()
    
    if not target_user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user_id = target_user['id']
    request_id = str(uuid.uuid4())
    
    try:
        cursor.execute(
            "INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, ?, ?)",
            (request_id, from_user_id, target_user_id, 'pending', datetime.now().isoformat())
        )
        conn.commit()
        
        # Get from username for notification
        cursor.execute("SELECT username FROM users WHERE id = ?", (from_user_id,))
        from_user = cursor.fetchone()
        
        conn.close()
        
        # Notify the target user if online
        await manager.send_personal_message({
            "type": "friend_request",
            "request": {
                "id": request_id,
                "from": from_user_id,
                "from_username": from_user['username'],
                "status": "pending",
                "created_at": datetime.now().isoformat()
            }
        }, target_user_id)
        
        return {"success": True, "request_id": request_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Request already exists")

@app.post("/friends/accept")
async def accept_friend_request(user_id: str = None, request_id: str = None):
    if not user_id or not request_id:
        raise HTTPException(status_code=400, detail="user_id and request_id required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ?", (request_id, user_id))
    request = cursor.fetchone()
    
    if not request:
        conn.close()
        raise HTTPException(status_code=404, detail="Request not found")
    
    from_user_id = request['from_user_id']
    
    try:
        cursor.execute("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", (request_id,))
        cursor.execute(
            "INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)",
            (user_id, from_user_id, datetime.now().isoformat())
        )
        cursor.execute(
            "INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)",
            (from_user_id, user_id, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        return {"success": True}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Already friends")

@app.get("/friends/requests/{user_id}")
async def get_friend_requests(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT fr.id, fr.from_user_id, u.username as from_username, fr.status, fr.created_at
        FROM friend_requests fr
        JOIN users u ON fr.from_user_id = u.id
        WHERE fr.to_user_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ''', (user_id,))
    
    requests_list = []
    for row in cursor.fetchall():
        requests_list.append({
            "id": row['id'],
            "from": row['from_user_id'],
            "from_username": row['from_username'],
            "status": row['status'],
            "created_at": row['created_at']
        })
    
    conn.close()
    return {"requests": requests_list}

@app.post("/friends/reject")
async def reject_friend_request(user_id: str = None, request_id: str = None):
    if not user_id or not request_id:
        raise HTTPException(status_code=400, detail="user_id and request_id required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("UPDATE friend_requests SET status = 'rejected' WHERE id = ? AND to_user_id = ?", (request_id, user_id))
    conn.commit()
    conn.close()
    
    return {"success": True}

@app.get("/messages/{user_id}/{friend_id}")
async def get_messages(user_id: str, friend_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, sender_id, content, timestamp, type
        FROM messages
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
        ORDER BY timestamp ASC
    ''', (user_id, friend_id, friend_id, user_id))
    
    messages_list = []
    for row in cursor.fetchall():
        messages_list.append({
            "id": row['id'],
            "sender_id": row['sender_id'],
            "content": row['content'],
            "timestamp": row['timestamp'],
            "type": row['type']
        })
    
    conn.close()
    return {"messages": messages_list}

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "message":
                # Send message to recipient
                recipient_id = data["recipient_id"]
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Get sender username
                cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
                sender = cursor.fetchone()
                sender_name = sender['username'] if sender else 'Unknown'
                
                # Save message to database
                message_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO messages (id, sender_id, recipient_id, content, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)",
                    (message_id, user_id, recipient_id, data["content"], datetime.now().isoformat(), "text")
                )
                conn.commit()
                
                message = {
                    "id": message_id,
                    "sender_id": user_id,
                    "sender_name": sender_name,
                    "recipient_id": recipient_id,
                    "content": data["content"],
                    "timestamp": datetime.now().isoformat(),
                    "type": "text"
                }
                
                conn.close()
                
                # Send to recipient if online
                await manager.send_personal_message({
                    "type": "message",
                    "message": message
                }, recipient_id)
                
                # Send confirmation back to sender
                await manager.send_personal_message({
                    "type": "message_sent",
                    "message": message
                }, user_id)
            
            elif data["type"] == "typing":
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
                sender = cursor.fetchone()
                conn.close()
                
                await manager.send_personal_message({
                    "type": "typing",
                    "user_id": user_id,
                    "username": sender['username'] if sender else 'Unknown'
                }, data["recipient_id"])
            
            elif data["type"] == "call":
                recipient_id = data["recipient_id"]
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
                sender = cursor.fetchone()
                conn.close()
                
                call_data = {
                    "id": str(uuid.uuid4()),
                    "type": data["call_type"],
                    "caller_id": user_id,
                    "caller_name": sender['username'] if sender else 'Unknown',
                    "callee_id": recipient_id,
                    "status": "ringing",
                    "created_at": datetime.now().isoformat()
                }
                
                await manager.send_personal_message({
                    "type": "incoming_call",
                    "call": call_data
                }, recipient_id)
            
            elif data["type"] == "call_response":
                recipient_id = data["recipient_id"]
                await manager.send_personal_message({
                    "type": "call_response",
                    "response": data["response"],
                    "call_id": data["call_id"]
                }, recipient_id)
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
