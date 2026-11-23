from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from db.db import init_db
from plants import router as plants_router
from admin import router as admin_router
from security import router as auth_router


import json


app = FastAPI(title="My API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(plants_router)
app.include_router(auth_router)
app.include_router(admin_router)

init_db()

# ------ПРОВЕРКА-------
@app.get("/")
def check():
    return json.dumps({ 
        "result": "ok",
        "data": True
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)