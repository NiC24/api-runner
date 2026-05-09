from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from executor import execute_batch, execute_request
import httpx

app = FastAPI(title="API Runner Backend")

import os

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RequestConfig(BaseModel):
    method: str = Field(..., description="HTTP Method (GET, POST, etc)")
    url: str = Field(..., description="Target URL (can contain {{Variables}})")
    headers: Dict[str, str] = Field(default_factory=dict, description="Headers (values can contain {{Variables}})")
    body: Optional[Any] = Field(None, description="Request body (can contain {{Variables}})")

class BatchExecutionRequest(BaseModel):
    config: RequestConfig
    rows: List[Dict[str, str]] = Field(..., description="List of parsed CSV rows (header -> value map)")
    concurrency_limit: int = Field(1, description="Number of concurrent requests")
    rate_limit_ms: int = Field(0, description="Delay between requests or semaphore starts in ms")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API Runner Backend is running"}

@app.post("/api/execute/single")
async def execute_single_endpoint(config: RequestConfig):
    # For a single request without variables, we just execute it directly
    async with httpx.AsyncClient() as client:
        # Note: if it has variables, they will remain as {{Var}} unless passed rows
        # This endpoint is primarily for quick testing without CSV
        result = await execute_request(client, config.method, config.url, config.headers, config.body)
        return {"result": result}

@app.post("/api/execute/batch")
async def execute_batch_endpoint(req: BatchExecutionRequest):
    if not req.rows:
        raise HTTPException(status_code=400, detail="No rows provided for batch execution")
        
    results = await execute_batch(
        method=req.config.method,
        url_template=req.config.url,
        headers_template=req.config.headers,
        body_template=req.config.body,
        rows=req.rows,
        concurrency_limit=req.concurrency_limit,
        rate_limit_ms=req.rate_limit_ms
    )
    
    # Calculate summary
    total = len(results)
    success = sum(1 for r in results if r["success"])
    failed = total - success
    
    return {
        "summary": {
            "total": total,
            "success": success,
            "failed": failed
        },
        "results": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
