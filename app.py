from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Replace this later with your real GitHub Pages URL
CORS(app, resources={r"/check": {"origins": "*"}})

@app.route("/")
def home():
    return "Backend is running"

@app.route("/check", methods=["POST"])
def check():
    data = request.get_json()
    message = data.get("message", "").lower()

    if "urgent" in message or "verify" in message or "bank" in message:
        result = "⚠️ This message may be phishing or scam."
    else:
        result = "✅ This message looks safe."

    return jsonify({"result": result})

if __name__ == "__main__":
    app.run(debug=True)
