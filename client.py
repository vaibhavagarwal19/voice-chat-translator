import socketio
import time

# Initialize Socket.IO client
sio = socketio.Client()

# Event handlers
@sio.event
def connect():
    print("Connected to server")
    # Join a call after connecting
    sio.emit('join_call', {
        'call_id': 'test_call',
        'spoken': 'en',
        'listen': 'fr'
    })

@sio.event
def disconnect():
    print("Disconnected from server")

@sio.event
def joined(data):
    print(f"Joined call: {data}")
    # Send a test text message after joining
    sio.emit('text_message', {'message': 'Hello, this is a test message!'})

@sio.event
def translated_text(data):
    print(f"Received translated text: {data}")

@sio.event
def error(data):
    print(f"Error: {data['message']}")

# Connect to the server
try:
    sio.connect('http://172.16.11.159:5000')
    sio.wait()  # Keep the client running
except Exception as e:
    print(f"Connection failed: {e}")