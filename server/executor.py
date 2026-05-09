import httpx
import asyncio
import re
from typing import List, Dict, Any, Optional
import time

def resolve_variables(template: str, variables: Dict[str, str]) -> str:
    """Replace {{VariableName}} with actual value from variables dict."""
    if not isinstance(template, str):
        return template
    
    def replacer(match):
        var_name = match.group(1).strip()
        # Fallback to original string if variable not found
        return str(variables.get(var_name, match.group(0)))
        
    return re.sub(r"\{\{([^}]+)\}\}", replacer, template)

def resolve_dict_variables(template_dict: Dict[str, Any], variables: Dict[str, str]) -> Dict[str, Any]:
    """Recursively resolve variables in a dictionary (e.g. headers or body)."""
    resolved = {}
    for k, v in template_dict.items():
        if isinstance(v, str):
            resolved[k] = resolve_variables(v, variables)
        elif isinstance(v, dict):
            resolved[k] = resolve_dict_variables(v, variables)
        elif isinstance(v, list):
            resolved[k] = [resolve_variables(item, variables) if isinstance(item, str) else item for item in v]
        else:
            resolved[k] = v
    return resolved

async def execute_request(client: httpx.AsyncClient, method: str, url: str, headers: Dict[str, str], body: Any) -> Dict[str, Any]:
    start_time = time.time()
    try:
        if method.upper() in ["POST", "PUT", "PATCH"]:
            response = await client.request(method, url, headers=headers, json=body)
        else:
            response = await client.request(method, url, headers=headers)
        
        duration = int((time.time() - start_time) * 1000)
        try:
            resp_data = response.json()
        except ValueError:
            resp_data = response.text

        return {
            "success": 200 <= response.status_code < 300,
            "status_code": response.status_code,
            "duration_ms": duration,
            "response": resp_data,
            "error": None
        }
    except Exception as e:
        duration = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "status_code": 0,
            "duration_ms": duration,
            "response": None,
            "error": str(e)
        }

async def execute_batch(
    method: str, 
    url_template: str, 
    headers_template: Dict[str, str], 
    body_template: Any, 
    rows: List[Dict[str, str]], 
    concurrency_limit: int = 1,
    rate_limit_ms: int = 0
) -> List[Dict[str, Any]]:
    
    results = []
    
    async with httpx.AsyncClient() as client:
        if concurrency_limit > 1:
            semaphore = asyncio.Semaphore(concurrency_limit)
            
            async def bound_request(row_index, row):
                async with semaphore:
                    if rate_limit_ms > 0:
                        await asyncio.sleep(rate_limit_ms / 1000.0)
                        
                    url = resolve_variables(url_template, row)
                    headers = resolve_dict_variables(headers_template, row)
                    body = resolve_dict_variables(body_template, row) if body_template else None
                    
                    result = await execute_request(client, method, url, headers, body)
                    result["row_index"] = row_index
                    result["url"] = url
                    return result
            
            tasks = [bound_request(i, row) for i, row in enumerate(rows)]
            results = await asyncio.gather(*tasks)
            # sort by row_index to maintain order
            results.sort(key=lambda x: x["row_index"])
            
        else:
            # Sequential Execution
            for i, row in enumerate(rows):
                if i > 0 and rate_limit_ms > 0:
                    await asyncio.sleep(rate_limit_ms / 1000.0)
                
                url = resolve_variables(url_template, row)
                headers = resolve_dict_variables(headers_template, row)
                body = resolve_dict_variables(body_template, row) if body_template else None
                
                result = await execute_request(client, method, url, headers, body)
                result["row_index"] = i
                result["url"] = url
                results.append(result)
                
    return results
