from fastapi import FastAPI, Request
import json

app = FastAPI()

@app.post("/report")
async def receive_report(request: Request):
    data = await request.json()
    with open("test-report.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    return {"status": "success", "message": "Report saved successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)